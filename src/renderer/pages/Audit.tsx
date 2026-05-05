import { useEffect, useState } from 'react';

interface GateLogRow {
  id: number;
  outreach_id: number | null;
  prospect_id: number | null;
  phase: string;
  decision: string;
  reason: string | null;
  ts: string;
}

export default function Audit() {
  const [rows, setRows] = useState<GateLogRow[]>([]);
  const [filter, setFilter] = useState<string>('');

  async function refresh() {
    setRows(await window.api.getGateLog(undefined, 200));
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, []);

  const filtered = filter
    ? rows.filter((r) =>
        [r.phase, r.decision, r.reason ?? '', String(r.outreach_id ?? ''), String(r.prospect_id ?? '')]
          .join(' ')
          .toLowerCase()
          .includes(filter.toLowerCase())
      )
    : rows;

  return (
    <div className="p-10 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Pipeline audit</h1>
          <p className="text-ink-200/60 text-sm mt-1">Every gate decision the agent has made. Full trace of what the agent saw and why it dropped or passed.</p>
        </div>
        <input
          className="input max-w-xs"
          placeholder="Filter by phase, decision, reason…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        />
      </div>

      <div className="card mt-6 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-200/50 border-b border-white/5">
              <th className="px-4 py-3">When</th>
              <th className="px-4 py-3">Phase</th>
              <th className="px-4 py-3">Decision</th>
              <th className="px-4 py-3">Reason</th>
              <th className="px-4 py-3">Outreach</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={5} className="px-4 py-6 text-center text-ink-200/40">No gate decisions yet.</td></tr>
            )}
            {filtered.map((r) => (
              <tr key={r.id} className="border-b border-white/5 last:border-0">
                <td className="px-4 py-2 text-xs text-ink-200/50 font-mono">{r.ts}</td>
                <td className="px-4 py-2"><span className="pill bg-white/10 text-ink-200/80">Phase {r.phase}</span></td>
                <td className="px-4 py-2"><DecisionPill d={r.decision} /></td>
                <td className="px-4 py-2 text-ink-200/80">{r.reason ?? '—'}</td>
                <td className="px-4 py-2 text-ink-200/50 text-xs">{r.outreach_id ?? r.prospect_id ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DecisionPill({ d }: { d: string }) {
  const cls =
    d === 'pass'
      ? 'bg-emerald-500/20 text-emerald-200'
      : d === 'drop'
        ? 'bg-red-500/20 text-red-200'
        : 'bg-yellow-500/20 text-yellow-200';
  return <span className={`pill ${cls}`}>{d}</span>;
}
