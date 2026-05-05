import { useEffect, useMemo, useState } from 'react';
import { pushToast } from '../components/Toast';

interface Row {
  id: number;
  full_name: string;
  company_name: string | null;
  motion: string;
  status: string;
  confidence: number | null;
  drafted_at: string;
  sent_at: string | null;
}

const STATUS_OPTIONS = ['all', 'draft', 'sent', 'accepted', 'replied', 'failed', 'dropped'] as const;
type StatusFilter = typeof STATUS_OPTIONS[number];

export default function Activity({
  onOpen,
  onOpenDetail
}: {
  onOpen?: () => void;
  onOpenDetail?: (id: number) => void;
}) {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [selected, setSelected] = useState<Set<number>>(new Set());

  useEffect(() => {
    let live = true;
    const tick = async () => {
      const r = await window.api.listOutreach(200);
      if (live) setRows(r);
    };
    void tick();
    const id = setInterval(tick, 5000);
    return () => { live = false; clearInterval(id); };
  }, []);

  // Keyboard shortcuts for bulk selection.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const meta = e.metaKey || e.ctrlKey;
      const target = e.target as HTMLElement | null;
      const isInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable);
      // Cmd+A select all visible (we recompute filtered inside the handler).
      if (meta && (e.key === 'a' || e.key === 'A') && !isInput) {
        e.preventDefault();
        setSelected(() => {
          const visibleIds = (statusFilter === 'all' ? rows : rows.filter((r) => r.status === statusFilter))
            .filter((r) => !query.trim() || [r.full_name, r.company_name ?? '', r.motion, r.status].join(' ').toLowerCase().includes(query.toLowerCase()))
            .map((r) => r.id);
          return new Set(visibleIds);
        });
      }
      // Esc clear selection.
      if (e.key === 'Escape' && !isInput) {
        setSelected((prev) => (prev.size > 0 ? new Set() : prev));
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rows, query, statusFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: rows.length };
    for (const r of rows) c[r.status] = (c[r.status] ?? 0) + 1;
    return c;
  }, [rows]);

  const filtered = useMemo(() => {
    let out = rows;
    if (statusFilter !== 'all') out = out.filter((r) => r.status === statusFilter);
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((r) =>
        [r.full_name, r.company_name ?? '', r.motion, r.status].join(' ').toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, query, statusFilter]);

  function toggleSelect(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(visibleIds: number[]) {
    setSelected((prev) => {
      const allSelected = visibleIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        visibleIds.forEach((id) => next.delete(id));
        return next;
      }
      return new Set([...prev, ...visibleIds]);
    });
  }

  async function bulkClassify(c: 'P0_warm' | 'P1_engaged' | 'P2_decline' | 'P3_auto_reply' | 'P4_hostile') {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    const reason = window.prompt(
      `Override classification on ${ids.length} row${ids.length === 1 ? '' : 's'} to ${c}.\n\nOptional: why? (saved to audit trail; cancel aborts the change)`,
      ''
    );
    if (reason === null) return; // cancel
    const r = await window.api.setReplyClassificationBulk(ids, c, reason || undefined);
    if (r.ok) pushToast('success', `Classified ${r.updated} row${r.updated === 1 ? '' : 's'} as ${c}`);
    setSelected(new Set());
  }

  async function bulkReverseDnc() {
    const ids = Array.from(selected);
    if (ids.length === 0) return;
    if (!window.confirm(`Reverse auto-DNC entries tied to ${ids.length} outreach row${ids.length === 1 ? '' : 's'}? Manual DNC entries are not affected.`)) return;
    const r = await window.api.reverseAutoDncBulk(ids);
    if (r.ok) pushToast('success', `Reversed ${r.removed} auto-DNC entr${r.removed === 1 ? 'y' : 'ies'}`);
    setSelected(new Set());
  }

  return (
    <div className="p-10 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Activity</h1>
          <p className="text-ink-200/60 text-sm mt-1">Recent drafts and sends. Click a row to drill in. Use the checkboxes to bulk-override classifications.</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-ghost" onClick={async () => {
            const r = await window.api.exportActivity();
            const blob = new Blob([r.csv], { type: 'text/csv;charset=utf-8' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(link.href);
          }}>Export CSV</button>
          {onOpen && <button className="btn-ghost" onClick={onOpen}>Open audit log</button>}
        </div>
      </div>

      <div className="mt-6 flex items-center gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search prospects, companies…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`pill text-xs px-2.5 py-1 transition-colors ${
                statusFilter === s
                  ? 'bg-accent/30 text-white border border-accent/40'
                  : 'bg-white/5 text-ink-200/70 hover:bg-white/10 border border-transparent'
              }`}
            >
              {s} {counts[s] ? <span className="opacity-60 ml-1">{counts[s]}</span> : null}
            </button>
          ))}
        </div>
      </div>

      {rows.length === 0 ? (
        <EmptyActivity />
      ) : (
      <>
      {selected.size > 0 && (
        <div className="card mt-4 p-3 flex items-center gap-3 border-accent/40 bg-accent/5">
          <span className="text-sm font-medium">{selected.size} row{selected.size === 1 ? '' : 's'} selected</span>
          <span className="text-xs text-ink-200/60">Bulk classification override:</span>
          {(['P0_warm', 'P1_engaged', 'P2_decline', 'P3_auto_reply', 'P4_hostile'] as const).map((c) => (
            <button key={c} className="btn-ghost text-xs px-2 py-1" onClick={() => bulkClassify(c)}>
              {c.replace('_', ' ').replace('P', 'P')}
            </button>
          ))}
          <button className="btn-ghost text-xs ml-auto text-red-200/80" onClick={bulkReverseDnc}>Reverse auto-DNC</button>
          <button className="btn-ghost text-xs" onClick={() => setSelected(new Set())}>Clear selection</button>
        </div>
      )}
      <div className="card mt-4 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-200/50 border-b border-white/5">
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  checked={filtered.length > 0 && filtered.every((r) => selected.has(r.id))}
                  onChange={() => toggleSelectAll(filtered.map((r) => r.id))}
                  aria-label="Select all visible rows"
                />
              </th>
              <th className="px-4 py-3">Prospect</th>
              <th className="px-4 py-3">Company</th>
              <th className="px-4 py-3">Motion</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Conf.</th>
              <th className="px-4 py-3">When</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center text-ink-200/40">
                No rows match your filter.
              </td></tr>
            )}
            {filtered.map((r) => {
              const isSel = selected.has(r.id);
              return (
                <tr
                  key={r.id}
                  onClick={() => onOpenDetail?.(r.id)}
                  className={`border-b border-white/5 last:border-0 ${
                    isSel ? 'bg-accent/10' : ''
                  } ${onOpenDetail ? 'cursor-pointer hover:bg-white/5' : ''}`}
                >
                  <td className="px-3 py-3 w-8" onClick={(e) => { e.stopPropagation(); toggleSelect(r.id); }}>
                    <input
                      type="checkbox"
                      checked={isSel}
                      onChange={() => toggleSelect(r.id)}
                      aria-label={`Select ${r.full_name}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium">{r.full_name}</td>
                  <td className="px-4 py-3 text-ink-200/70">{r.company_name ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-200/70">{r.motion === 'connection_request' ? 'Connect' : 'InMail'}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-ink-200/70">{r.confidence?.toFixed(1) ?? '—'}</td>
                  <td className="px-4 py-3 text-ink-200/50 text-xs">{r.sent_at ?? r.drafted_at}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      </>
      )}
    </div>
  );
}

function EmptyActivity() {
  async function loadDemo() {
    const r = await window.api.loadDemoSeeds();
    if (r.inserted > 0) {
      // Force a refresh by reloading.
      window.location.reload();
    }
  }
  return (
    <div className="card mt-4 p-12 text-center">
      <div className="text-4xl mb-3 opacity-40">≡</div>
      <h2 className="text-base font-medium">No outreach yet</h2>
      <p className="text-sm text-ink-200/60 mt-1 max-w-md mx-auto">
        Run your first prospect via New Outreach, or load demo seeds to see the app populated for rehearsal.
      </p>
      <div className="mt-6 flex items-center justify-center gap-2">
        <button className="btn-primary" onClick={() => (window.location.hash = '#new')}>New Outreach</button>
        <button className="btn-ghost" onClick={loadDemo}>Load demo seeds</button>
      </div>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: 'bg-white/10 text-ink-200/70',
    queued: 'bg-blue-500/20 text-blue-200',
    sent: 'bg-emerald-500/20 text-emerald-200',
    accepted: 'bg-emerald-500/30 text-emerald-100',
    replied: 'bg-purple-500/20 text-purple-200',
    declined: 'bg-yellow-500/20 text-yellow-200',
    failed: 'bg-red-500/20 text-red-200',
    dropped: 'bg-red-500/10 text-red-200/70'
  };
  return <span className={`pill ${cls[status] ?? 'bg-white/10'}`}>{status}</span>;
}
