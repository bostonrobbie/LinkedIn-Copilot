// Accounts list with drill-down. Click an account row → see all prospects + outreach
// at that company. ABM-style visibility.

import { useEffect, useMemo, useState } from 'react';

interface AccountRow {
  id: number;
  name: string;
  domain: string | null;
  tier: 'TAM' | 'Factor' | 'G2' | 'Other';
  location: string | null;
  prospect_count: number;
  sent_count: number;
  accepted_count: number;
}

interface AccountDetail {
  account: { id: number; name: string; domain: string | null; tier: string; location: string | null; linkedin_url: string | null };
  prospects: Array<{ id: number; full_name: string; title: string | null; linkedin_url: string }>;
  outreach: Array<{
    id: number;
    full_name: string;
    title: string | null;
    motion: string;
    status: string;
    confidence: number | null;
    drafted_at: string;
    sent_at: string | null;
  }>;
}

const TIER_OPTIONS = ['all', 'Factor', 'G2', 'TAM'] as const;
type TierFilter = typeof TIER_OPTIONS[number];

export default function Accounts({
  onOpenOutreach
}: {
  onOpenOutreach?: (id: number) => void;
}) {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [query, setQuery] = useState('');
  const [tier, setTier] = useState<TierFilter>('all');
  const [activeId, setActiveId] = useState<number | null>(null);
  const [detail, setDetail] = useState<AccountDetail | null>(null);

  useEffect(() => {
    void window.api.listAccounts().then(setRows as (r: unknown) => void);
  }, []);

  useEffect(() => {
    if (activeId === null) { setDetail(null); return; }
    void window.api.getAccountDetail(activeId).then((d) => setDetail(d as AccountDetail | null));
  }, [activeId]);

  const filtered = useMemo(() => {
    let out = rows;
    if (tier !== 'all') out = out.filter((r) => r.tier === tier);
    if (query.trim()) {
      const q = query.toLowerCase();
      out = out.filter((r) =>
        [r.name, r.domain ?? '', r.location ?? ''].join(' ').toLowerCase().includes(q)
      );
    }
    return out;
  }, [rows, query, tier]);

  return (
    <div className="flex h-full">
      <aside className="w-96 shrink-0 border-r border-white/5 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-white/5">
          <h1 className="text-base font-semibold tracking-tight">Accounts</h1>
          <p className="text-xs text-ink-200/50 mt-0.5">{rows.length.toLocaleString()} total · ranked by accept count</p>

          <input
            className="input mt-3 text-sm"
            placeholder="Search by name, domain, location…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {TIER_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setTier(t)}
                className={`pill text-xs px-2 py-1 border transition-colors ${
                  tier === t ? 'bg-accent/30 border-accent/40 text-white' : 'bg-white/5 border-transparent text-ink-200/70 hover:bg-white/10'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && (
            <div className="p-6 text-center text-xs text-ink-200/40">No accounts match your filter.</div>
          )}
          {filtered.map((r) => (
            <button
              key={r.id}
              onClick={() => setActiveId(r.id)}
              className={`w-full text-left px-4 py-3 border-b border-white/5 transition-colors ${
                activeId === r.id ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="font-medium text-sm truncate">{r.name}</div>
                <TierPill tier={r.tier} />
              </div>
              <div className="text-xs text-ink-200/50 mt-0.5 truncate">{r.domain ?? '—'} · {r.location ?? '—'}</div>
              <div className="text-xs mt-1 flex items-center gap-3 text-ink-200/70">
                <span>{r.prospect_count} prospects</span>
                <span className="text-emerald-200/70">{r.sent_count} sent</span>
                <span className="text-purple-200/70">{r.accepted_count} accepted</span>
              </div>
            </button>
          ))}
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto">
        {detail ? <AccountDetailView detail={detail} onOpenOutreach={onOpenOutreach} /> : (
          <div className="p-10 text-ink-200/40 text-sm">Pick an account to see prospects + outreach history.</div>
        )}
      </main>
    </div>
  );
}

function TierPill({ tier }: { tier: string }) {
  const cls =
    tier === 'Factor'
      ? 'bg-orange-500/20 text-orange-200'
      : tier === 'G2'
        ? 'bg-purple-500/20 text-purple-200'
        : tier === 'TAM'
          ? 'bg-blue-500/20 text-blue-200'
          : 'bg-white/10 text-ink-200/60';
  return <span className={`pill text-[10px] ${cls}`}>{tier}</span>;
}

function AccountDetailView({
  detail,
  onOpenOutreach
}: {
  detail: AccountDetail;
  onOpenOutreach?: (id: number) => void;
}) {
  const sent = detail.outreach.filter((o) => o.status !== 'draft' && o.status !== 'dropped');
  const accepts = detail.outreach.filter((o) => o.status === 'accepted' || o.status === 'replied');
  const acceptRate = sent.length > 0 ? ((accepts.length / sent.length) * 100).toFixed(0) : '—';

  return (
    <div className="p-10">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{detail.account.name}</h1>
            <TierPill tier={detail.account.tier} />
          </div>
          <div className="text-sm text-ink-200/60 mt-1">
            {detail.account.domain ?? '—'} · {detail.account.location ?? '—'}
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-3 gap-3">
        <Stat label="Prospects" value={String(detail.prospects.length)} />
        <Stat label="Sent" value={String(sent.length)} />
        <Stat label="Accept rate" value={`${acceptRate}${acceptRate !== '—' ? '%' : ''}`} sub={`${accepts.length} accepted`} />
      </div>

      <section className="card p-6 mt-4">
        <h2 className="text-base font-medium">Outreach history</h2>
        {detail.outreach.length === 0 ? (
          <div className="text-sm text-ink-200/40 mt-3">No outreach at this account yet.</div>
        ) : (
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-200/50 border-b border-white/5">
                <th className="py-2">Prospect</th>
                <th className="py-2">Motion</th>
                <th className="py-2">Status</th>
                <th className="py-2">Conf.</th>
                <th className="py-2">When</th>
              </tr>
            </thead>
            <tbody>
              {detail.outreach.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => onOpenOutreach?.(o.id)}
                  className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5"
                >
                  <td className="py-2 font-medium">{o.full_name}<div className="text-xs text-ink-200/50 font-normal">{o.title ?? '—'}</div></td>
                  <td className="py-2 text-ink-200/70">{o.motion === 'connection_request' ? 'Connect' : 'InMail'}</td>
                  <td className="py-2"><StatusPill status={o.status} /></td>
                  <td className="py-2 text-ink-200/70">{o.confidence?.toFixed(1) ?? '—'}</td>
                  <td className="py-2 text-ink-200/50 text-xs">{o.sent_at ?? o.drafted_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card p-6 mt-4">
        <h2 className="text-base font-medium">Prospects researched</h2>
        {detail.prospects.length === 0 ? (
          <div className="text-sm text-ink-200/40 mt-3">No prospects researched at this account yet.</div>
        ) : (
          <ul className="mt-3 divide-y divide-white/5">
            {detail.prospects.map((p) => (
              <li key={p.id} className="py-2 text-sm flex items-center justify-between">
                <div>
                  <div className="font-medium">{p.full_name}</div>
                  <div className="text-xs text-ink-200/50">{p.title ?? '—'}</div>
                </div>
                <a className="text-xs text-accent hover:underline" href={p.linkedin_url} target="_blank" rel="noreferrer">LinkedIn</a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-ink-200/50">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-ink-200/40 mt-1">{sub}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: 'bg-white/10 text-ink-200/70',
    sent: 'bg-emerald-500/20 text-emerald-200',
    accepted: 'bg-emerald-500/30 text-emerald-100',
    replied: 'bg-purple-500/20 text-purple-200',
    declined: 'bg-yellow-500/20 text-yellow-200',
    failed: 'bg-red-500/20 text-red-200',
    dropped: 'bg-red-500/10 text-red-200/70'
  };
  return <span className={`pill ${cls[status] ?? 'bg-white/10'}`}>{status}</span>;
}
