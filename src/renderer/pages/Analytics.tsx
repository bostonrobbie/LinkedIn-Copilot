import { useEffect, useState } from 'react';
import type { AnalyticsRollup, SyncResult } from '../../shared/types';
import { pushToast } from '../components/Toast';

type Reconciliation = Awaited<ReturnType<Window['api']['runReconciliation']>>;

export default function Analytics() {
  const [data, setData] = useState<AnalyticsRollup | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);
  const [reconcile, setReconcile] = useState<Reconciliation | null>(null);
  const [reconciling, setReconciling] = useState(false);
  const [lastReconcile, setLastReconcile] = useState<{ value: string; updated_at: string } | null>(null);

  async function refresh() {
    setData(await window.api.getAnalytics());
    setLastReconcile(await window.api.getLastReconciliation());
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 10_000);
    return () => clearInterval(id);
  }, []);

  async function sync() {
    setSyncing(true);
    setSyncResult(null);
    const r = await window.api.runSync();
    setSyncResult(r);
    setSyncing(false);
    await refresh();
  }

  async function runReconcile() {
    setReconciling(true);
    const r = await window.api.runReconciliation();
    setReconcile(r);
    setReconciling(false);
    pushToast('success', `Reconciliation complete — ${r.todayByMotionAndStatus.reduce((s, x) => s + x.c, 0)} sends today`);
    await refresh();
  }

  if (!data) {
    return <div className="p-10 text-ink-200/50">Loading…</div>;
  }

  const { totals, byMotion, recentSends, dropReasons } = data;
  const acceptRate = totals.sent > 0 ? ((totals.accepted / totals.sent) * 100).toFixed(1) : '0.0';
  const replyRate = totals.sent > 0 ? ((totals.replied / totals.sent) * 100).toFixed(1) : '0.0';

  return (
    <div className="p-10 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Analytics</h1>
          <p className="text-ink-200/60 text-sm mt-1">Outreach performance, drop reasons, and trend by day.</p>
        </div>
        <div className="flex items-center gap-3 text-sm">
          {syncResult && (
            <span className={syncResult.ok ? 'text-emerald-200' : 'text-red-200'}>
              {syncResult.ok
                ? `Synced — +${syncResult.newAccepts} accept, +${syncResult.newReplies} reply`
                : `Sync error: ${syncResult.error}`}
            </span>
          )}
          <button className="btn-ghost" onClick={sync} disabled={syncing}>
            {syncing ? 'Syncing…' : 'Sync replies'}
          </button>
          <button className="btn-ghost" onClick={runReconcile} disabled={reconciling}>
            {reconciling ? 'Reconciling…' : 'Run end-of-session reconciliation'}
          </button>
        </div>
      </div>

      {reconcile && (
        <ReconciliationReport report={reconcile} lastRun={lastReconcile} />
      )}

      <div className="mt-8 grid grid-cols-3 gap-4">
        <Stat label="Total sent" value={totals.sent} />
        <Stat label="Accept rate" value={`${acceptRate}%`} sub={`${totals.accepted} accepted`} />
        <Stat label="Reply rate" value={`${replyRate}%`} sub={`${totals.replied} replied`} />
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4">
        <div className="card p-6">
          <h2 className="text-base font-medium">By motion</h2>
          <table className="w-full text-sm mt-3">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-ink-200/50 border-b border-white/5">
                <th className="py-2">Motion</th>
                <th className="py-2">Sent</th>
                <th className="py-2">Accept %</th>
                <th className="py-2">Reply %</th>
              </tr>
            </thead>
            <tbody>
              {byMotion.length === 0 && (
                <tr><td colSpan={4} className="py-3 text-ink-200/40">No sends yet.</td></tr>
              )}
              {byMotion.map((r) => (
                <tr key={r.motion} className="border-b border-white/5 last:border-0">
                  <td className="py-2">{r.motion === 'connection_request' ? 'Connect' : 'InMail'}</td>
                  <td className="py-2">{r.sent}</td>
                  <td className="py-2">{r.acceptRate.toFixed(1)}%</td>
                  <td className="py-2">{r.replyRate.toFixed(1)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-6">
          <h2 className="text-base font-medium">Drops by reason</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {dropReasons.length === 0 && <li className="text-ink-200/40">No drops yet.</li>}
            {dropReasons.map((r) => (
              <li key={r.reason} className="flex items-center justify-between">
                <span>{r.reason}</span>
                <span className="text-ink-200/60">{r.count}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 card p-6">
        <h2 className="text-base font-medium">Last 14 days</h2>
        <div className="mt-3 space-y-1">
          {recentSends.length === 0 && <div className="text-sm text-ink-200/40">No sends yet.</div>}
          {recentSends.map((d) => (
            <div key={d.day} className="flex items-center gap-3 text-sm">
              <div className="w-24 text-ink-200/60 text-xs font-mono">{d.day}</div>
              <div className="flex-1 flex items-center gap-1 h-5">
                <Bar value={d.sent} max={Math.max(...recentSends.map((r) => r.sent))} color="bg-blue-500/60" />
                <Bar value={d.accepted} max={Math.max(...recentSends.map((r) => r.sent))} color="bg-emerald-500/60" />
                <Bar value={d.replied} max={Math.max(...recentSends.map((r) => r.sent))} color="bg-purple-500/60" />
              </div>
              <div className="text-xs text-ink-200/60 w-32 text-right">
                {d.sent} sent · {d.accepted} acc · {d.replied} rep
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex items-center gap-4 text-xs text-ink-200/50">
          <Legend color="bg-blue-500/60" label="sent" />
          <Legend color="bg-emerald-500/60" label="accepted" />
          <Legend color="bg-purple-500/60" label="replied" />
        </div>
      </div>
    </div>
  );
}

function ReconciliationReport({ report, lastRun }: { report: Reconciliation; lastRun: { value: string; updated_at: string } | null }) {
  const totalSentToday = report.todayByMotionAndStatus.reduce((s, x) => s + x.c, 0);
  const weekUtilizationPct = Math.round((report.week7d.sent / report.week7d.weeklyHardCap) * 100);
  return (
    <section className="card p-6 mt-6 border-l-4 border-l-blue-400">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-medium">End-of-session reconciliation · {report.today}</h2>
          <p className="text-xs text-ink-200/60 mt-1">
            Phase 9.6 (v7 BDR skill). Snapshot of today's sends, drops, queue health, and rolling 7-day window.
          </p>
        </div>
        {lastRun && (
          <div className="text-xs text-ink-200/50 font-mono">
            last run {new Date(lastRun.value).toLocaleString()}
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-4 gap-3">
        <SmallStat label="Sends today" value={String(totalSentToday)} />
        <SmallStat label="Drafts pending" value={String(report.draftedNotSent)} />
        <SmallStat
          label="7d cap usage"
          value={`${report.week7d.sent} / ${report.week7d.weeklyHardCap}`}
          sub={`${weekUtilizationPct}%`}
          severity={weekUtilizationPct >= 80 ? 'alert' : weekUtilizationPct >= 50 ? 'warn' : 'ok'}
        />
        <SmallStat
          label="Cooldown"
          value={report.cooldownActive ? 'ACTIVE' : 'inactive'}
          severity={report.cooldownActive ? 'alert' : 'ok'}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-4">
        <div>
          <div className="label">Today by motion + status</div>
          {report.todayByMotionAndStatus.length === 0 ? (
            <div className="text-xs text-ink-200/40 mt-2">No sends today yet.</div>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {report.todayByMotionAndStatus.map((r) => (
                <li key={`${r.motion}-${r.status}`} className="flex items-center justify-between">
                  <span>{r.motion === 'connection_request' ? 'Connect' : 'InMail'} · {r.status}</span>
                  <span className="text-ink-200/60">{r.c}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <div className="label">Today's drops by reason</div>
          {report.dropsByReason.length === 0 ? (
            <div className="text-xs text-ink-200/40 mt-2">No drops today.</div>
          ) : (
            <ul className="mt-2 space-y-1 text-sm">
              {report.dropsByReason.map((r) => (
                <li key={r.reason} className="flex items-center justify-between">
                  <span>{r.reason}</span>
                  <span className="text-ink-200/60">{r.count}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="mt-5">
        <div className="label">Send queue snapshot</div>
        <div className="mt-2 flex items-center gap-4 text-sm">
          <span><span className="text-blue-200">{report.queue.queued}</span> queued</span>
          <span><span className="text-emerald-200">{report.queue.doneToday}</span> done today</span>
          <span><span className="text-red-200">{report.queue.exhausted}</span> exhausted</span>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3 text-sm border-t border-white/5 pt-4">
        <SmallStat label="7-day sent" value={String(report.week7d.sent)} />
        <SmallStat label="7-day accepted" value={String(report.week7d.accepted)} />
        <SmallStat label="7-day replied" value={String(report.week7d.replied)} />
      </div>
    </section>
  );
}

function SmallStat({ label, value, sub, severity }: { label: string; value: string; sub?: string; severity?: 'ok' | 'warn' | 'alert' }) {
  const color =
    severity === 'alert' ? 'text-red-200' :
    severity === 'warn' ? 'text-yellow-200' :
    'text-ink-100';
  return (
    <div className="card p-3">
      <div className="text-[10px] uppercase tracking-wide text-ink-200/50">{label}</div>
      <div className={`text-lg font-semibold mt-1 ${color}`}>{value}</div>
      {sub && <div className="text-xs text-ink-200/40 mt-0.5">{sub}</div>}
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wide text-ink-200/50">{label}</div>
      <div className="text-2xl font-semibold mt-1">{value}</div>
      {sub && <div className="text-xs text-ink-200/40 mt-1">{sub}</div>}
    </div>
  );
}

function Bar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? (value / max) * 100 : 0;
  return <div className={`${color} h-3 rounded-sm`} style={{ width: `${pct}%`, minWidth: value > 0 ? '4px' : '0' }} />;
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={`${color} w-3 h-3 rounded-sm`} />
      <span>{label}</span>
    </div>
  );
}
