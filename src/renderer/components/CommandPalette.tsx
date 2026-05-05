// Command palette (Cmd+K). Fuzzy search across nav actions, prospects, accounts.
// Loads on first open, refreshes when reopened.

import { useEffect, useMemo, useRef, useState } from 'react';

export type PaletteAction =
  | { kind: 'nav'; id: string; label: string; hint: string }
  | { kind: 'prospect'; id: number; label: string; hint: string }
  | { kind: 'account'; id: number; label: string; hint: string };

interface PaletteHandlers {
  onNav: (id: string) => void;
  onOpenOutreach: (id: number) => void;
  onOpenAccount: (id: number) => void;
}

const NAV_ACTIONS: Array<{ id: string; label: string; hint: string }> = [
  { id: 'home', label: 'Home', hint: 'today\'s actions' },
  { id: 'new', label: 'New Outreach', hint: 'wizard' },
  { id: 'activity', label: 'Activity', hint: 'all drafts and sends' },
  { id: 'accounts', label: 'Accounts', hint: 'TAM / Factor / G2 list' },
  { id: 'analytics', label: 'Analytics', hint: 'metrics' },
  { id: 'playbook', label: 'Playbook', hint: 'BDR skills + locked formulas' },
  { id: 'audit', label: 'Audit', hint: 'gate decisions' },
  { id: 'settings', label: 'Settings', hint: 'API keys, LinkedIn login' }
];

export function useCommandPalette(): { open: boolean; setOpen: (b: boolean) => void } {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      if (meta && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return { open, setOpen };
}

export default function CommandPalette({
  open,
  onClose,
  handlers
}: {
  open: boolean;
  onClose: () => void;
  handlers: PaletteHandlers;
}) {
  const [query, setQuery] = useState('');
  const [actions, setActions] = useState<PaletteAction[]>([]);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setHighlight(0);
    setTimeout(() => inputRef.current?.focus(), 50);

    void (async () => {
      const [outreach, accounts] = await Promise.all([
        window.api.listOutreach(200),
        window.api.listAccounts()
      ]);
      const all: PaletteAction[] = [
        ...NAV_ACTIONS.map((n) => ({ kind: 'nav' as const, id: n.id, label: n.label, hint: n.hint })),
        ...outreach.map((o) => ({
          kind: 'prospect' as const,
          id: o.id,
          label: o.full_name,
          hint: `${o.company_name ?? ''} · ${o.status} · ${o.motion === 'connection_request' ? 'Connect' : 'InMail'}`
        })),
        ...accounts.map((a) => ({
          kind: 'account' as const,
          id: a.id,
          label: a.name,
          hint: `${a.tier} · ${a.prospect_count} prospects · ${a.sent_count} sent`
        }))
      ];
      setActions(all);
    })();
  }, [open]);

  const filtered = useMemo(() => {
    if (!query.trim()) return actions.slice(0, 50);
    const q = query.toLowerCase();
    const scored = actions
      .map((a) => {
        const label = a.label.toLowerCase();
        const hint = a.hint.toLowerCase();
        if (label.startsWith(q)) return { a, score: 100 };
        if (label.includes(q)) return { a, score: 50 };
        if (hint.includes(q)) return { a, score: 20 };
        // Fuzzy: all chars in order.
        let i = 0;
        for (const ch of q) {
          const idx = label.indexOf(ch, i);
          if (idx < 0) return null;
          i = idx + 1;
        }
        return { a, score: 5 };
      })
      .filter((x): x is { a: PaletteAction; score: number } => x !== null)
      .sort((x, y) => y.score - x.score)
      .slice(0, 50);
    return scored.map((s) => s.a);
  }, [query, actions]);

  useEffect(() => {
    if (highlight >= filtered.length) setHighlight(Math.max(0, filtered.length - 1));
  }, [filtered, highlight]);

  function trigger(a: PaletteAction) {
    onClose();
    if (a.kind === 'nav') handlers.onNav(a.id);
    else if (a.kind === 'prospect') handlers.onOpenOutreach(a.id);
    else if (a.kind === 'account') handlers.onOpenAccount(a.id);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight((h) => Math.min(filtered.length - 1, h + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight((h) => Math.max(0, h - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const a = filtered[highlight];
      if (a) trigger(a);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-ink-900/85 backdrop-blur flex items-start justify-center pt-24 px-8" onClick={onClose}>
      <div className="card max-w-2xl w-full overflow-hidden border-white/10" onClick={(e) => e.stopPropagation()}>
        <input
          ref={inputRef}
          className="w-full bg-transparent border-0 px-5 py-4 text-base outline-none placeholder:text-ink-200/40 border-b border-white/5"
          placeholder="Jump to anything…  (prospect, account, action)"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setHighlight(0); }}
          onKeyDown={onKeyDown}
        />
        <div className="max-h-96 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="px-5 py-6 text-sm text-ink-200/40 text-center">No matches.</div>
          )}
          {filtered.map((a, i) => (
            <button
              key={`${a.kind}-${a.id}`}
              onClick={() => trigger(a)}
              onMouseEnter={() => setHighlight(i)}
              className={`w-full text-left px-5 py-3 flex items-center gap-3 ${i === highlight ? 'bg-white/10' : 'hover:bg-white/5'}`}
            >
              <KindBadge kind={a.kind} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{a.label}</div>
                <div className="text-xs text-ink-200/50 truncate">{a.hint}</div>
              </div>
              {i === highlight && <span className="text-[10px] text-ink-200/40 font-mono">↵</span>}
            </button>
          ))}
        </div>
        <div className="px-5 py-2 border-t border-white/5 text-[10px] text-ink-200/40 flex items-center gap-4 font-mono">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>esc close</span>
          <span className="ml-auto">⌘K to toggle</span>
        </div>
      </div>
    </div>
  );
}

function KindBadge({ kind }: { kind: PaletteAction['kind'] }) {
  const cls =
    kind === 'nav' ? 'bg-blue-500/20 text-blue-200' :
    kind === 'prospect' ? 'bg-emerald-500/20 text-emerald-200' :
    'bg-purple-500/20 text-purple-200';
  return <span className={`pill text-[10px] ${cls} shrink-0`}>{kind}</span>;
}
