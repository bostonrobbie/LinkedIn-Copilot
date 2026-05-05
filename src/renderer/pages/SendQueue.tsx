// Send Queue view — shows persistent retry-queued sends with status, attempt
// count, last error, and per-row Retry / Cancel actions. Without this UI the
// queue runs invisibly and the rep has no way to see what's pending.

import { useEffect, useState } from 'react';
import { pushToast } from '../components/Toast';

interface QueueRow {
  id: number;
  outreach_id: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  status: 'queued' | 'running' | 'exhausted' | 'done' | 'cancelled';
  full_name?: string;
  company_name?: string | null;
  motion?: 'connection_request' | 'sales_nav_inmail';
}

export default function SendQueue({ onOpenDetail }: { onOpenDetail?: (id: number) => void }) {
  const [rows, setRows] = useState<QueueRow[]>([]);
  const [filter, setFilter] = useState<'all' | 'queued' | 'running' | 'exhausted' | 'done' | 'cancelled'>('all');

  async function refresh() {
    const r = await window.api.listSendQueue();
    setRows(r as QueueRow[]);
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 5_000);
    return () => clearInterval(id);
  }, []);

  async function retryNow(id: number) {
    const r = await window.api.retrySendQueueNow(id);
    if (r.ok) pushToast('success', 'Queued for immediate retry');
    else pushToast('error', `Retry failed: ${r.error ?? 'unknown'}`);
    await refresh();
  }

  async function cancel(id: number) {
    if (!window.confirm('Cancel this queued retry? The outreach stays in failed state but the worker won\'t pick it up again.')) return;
    const r = await window.api.cancelSendQueue(id);
    if (r.ok) pushToast('info', 'Cancelled');
    await refresh();
  }

  const filtered = filter === 'all' ? rows : rows.filter((r) => r.status === filter);
  const counts = rows.reduce<Record<string, number>>((acc, r) => {
    acc[r.status] = (acc[r.status] ?? 0) + 1;
    return acc;
  }, { all: rows.length });

  return (
    <div className="p-10 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Send Queue</h1>
          <p className="text-ink-200/60 text-sm mt-1">
            Watchdog-timed-out sends queue here for backoff retry. Survives app crash. Backoff: 1m → 5m → 15m → 60m → 240m. Max 5 attempts (1 for INC-030 InMail credit-burn pattern).
          </p>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-1.5">
        {(['all', 'queued', 'running', 'exhausted', 'done', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`pill text-xs px-2.5 py-1 transition-colors border ${
              filter === s
                ? 'bg-accent/30 text-white border-accent/40'
                : 'bg-white/5 text-ink-200/70 hover:bg-white/10 border-transparent'
            }`}
          >
            {s} {counts[s] ? <span className="opacity-60 ml-1">{counts[s]}</span> : null}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="card mt-6 p-12 text-center">
          <div className="text-4xl mb-3 opacity-40">⊘</div>
          <h2 className="text-base font-medium">{rows.length === 0 ? 'Queue is empty' : 'No rows match filter'}</h2>
          <p className="text-sm text-ink-200/60 mt-1">
            {rows.length === 0
              ? 'Sends only land here when watchdog timeouts or transient LinkedIn errors trip the retry path.'
              : 'Try the "all" filter or wait for new activity.'}
          </p>
        </div>
      ) : (
        <div className="card mt-6 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-200/50 border-b border-white/5">
                <th className="px-4 py-3">Prospect</th>
                <th className="px-4 py-3">Motion</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Attempts</th>
                <th className="px-4 py-3">Next retry</th>
                <th className="px-4 py-3">Last error</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr
                  key={r.id}
                  onClick={() => onOpenDetail?.(r.outreach_id)}
                  className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/5"
                >
                  <td className="px-4 py-3">
                    <div className="font-medium">{r.full_name ?? `outreach #${r.outreach_id}`}</div>
                    <div className="text-xs text-ink-200/50">{r.company_name ?? '—'}</div>
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-200/70">
                    {r.motion === 'connection_request' ? 'Connect' : r.motion === 'sales_nav_inmail' ? 'InMail' : '—'}
                  </td>
                  <td className="px-4 py-3"><QueueStatusPill status={r.status} /></td>
                  <td className="px-4 py-3 text-xs text-ink-200/70 font-mono">
                    {r.attempts} / {r.max_attempts}
                  </td>
                  <td className="px-4 py-3 text-xs text-ink-200/50 font-mono">
                    {r.status === 'queued' ? r.next_attempt_at : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs text-red-200/70 max-w-xs truncate" title={r.last_error ?? ''}>
                    {r.last_error ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                    {(r.status === 'queued' || r.status === 'exhausted') && (
                      <button className="btn-ghost text-xs mr-1" onClick={() => retryNow(r.id)}>Retry now</button>
                    )}
                    {r.status !== 'done' && r.status !== 'cancelled' && (
                      <button className="btn-ghost text-xs text-red-200/80" onClick={() => cancel(r.id)}>Cancel</button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function QueueStatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    queued: 'bg-blue-500/20 text-blue-200',
    running: 'bg-yellow-500/20 text-yellow-200',
    exhausted: 'bg-red-500/20 text-red-200',
    done: 'bg-emerald-500/20 text-emerald-200',
    cancelled: 'bg-white/10 text-ink-200/60'
  };
  return <span className={`pill text-xs ${cls[status] ?? 'bg-white/10'}`}>{status}</span>;
}
