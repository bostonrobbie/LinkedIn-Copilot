// System Health page — runs preflight self-test, shows real-time diagnostics,
// surfaces the tail of electron-log/main.log so the user can debug without
// digging through userData. Auto-refreshes every 15s.

import { useEffect, useState } from 'react';
import { pushToast } from '../components/Toast';

interface Check {
  id: string;
  label: string;
  status: 'ok' | 'warn' | 'error' | 'info';
  detail: string;
  fixHint?: string;
  meta?: Record<string, unknown>;
}

interface PreflightReport {
  ts: string;
  overall: 'ok' | 'warn' | 'error' | 'info';
  checks: Check[];
}

interface LogEntry {
  ts: string | null;
  level: string | null;
  text: string;
  raw: string;
}

interface LogTail {
  path: string | null;
  size: number;
  entries: LogEntry[];
}

export default function Health() {
  const [report, setReport] = useState<PreflightReport | null>(null);
  const [logTail, setLogTail] = useState<LogTail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [installLog, setInstallLog] = useState<string[]>([]);
  const [installing, setInstalling] = useState(false);

  async function refresh() {
    setRefreshing(true);
    try {
      const [r, l] = await Promise.all([window.api.runPreflight(), window.api.getLogTail(200)]);
      setReport(r);
      setLogTail(l);
    } finally {
      setRefreshing(false);
    }
  }

  async function installChromium() {
    setInstalling(true);
    setInstallLog([]);
    const off = window.api.onChromiumInstallProgress((line) => setInstallLog((prev) => [...prev, line]));
    try {
      const r = await window.api.installChromium();
      if (r.ok) {
        pushToast('success', 'Playwright Chromium installed');
        await refresh();
      } else {
        pushToast('error', `Install failed: ${r.error ?? 'unknown'}`);
      }
    } finally {
      off();
      setInstalling(false);
    }
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 15_000);
    return () => clearInterval(id);
  }, []);

  if (!report) {
    return <div className="p-10 text-ink-200/40 text-sm">Running preflight…</div>;
  }

  const okCount = report.checks.filter((c) => c.status === 'ok').length;
  const warnCount = report.checks.filter((c) => c.status === 'warn').length;
  const errCount = report.checks.filter((c) => c.status === 'error').length;
  const infoCount = report.checks.filter((c) => c.status === 'info').length;

  return (
    <div className="p-10 max-w-4xl">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-semibold tracking-tight">System Health</h1>
            <OverallPill status={report.overall} />
          </div>
          <p className="text-ink-200/60 text-sm mt-1">
            Preflight self-test runs on launch and every 15s. {okCount} ok · {warnCount} warn · {errCount} error · {infoCount} info.
          </p>
          <p className="text-xs text-ink-200/40 mt-1">Last run {new Date(report.ts).toLocaleTimeString([], { hour12: false })}</p>
        </div>
        <button className="btn-ghost" onClick={refresh} disabled={refreshing}>
          {refreshing ? 'Running…' : 'Run now'}
        </button>
      </div>

      <section className="card mt-6 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5">
          <h2 className="text-sm font-medium">Diagnostics</h2>
        </div>
        <ul className="divide-y divide-white/5">
          {report.checks.map((c) => (
            <li key={c.id} className="px-5 py-3 flex items-start gap-3">
              <CheckIcon status={c.status} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{c.label}</span>
                  <StatusPill status={c.status} />
                </div>
                <div className="text-xs text-ink-200/60 mt-0.5 break-all">{c.detail}</div>
                {c.fixHint && (
                  <div className={`text-xs mt-1 ${c.status === 'error' ? 'text-red-200/80' : 'text-yellow-200/80'}`}>
                    Fix: {c.fixHint}
                  </div>
                )}
                {c.id === 'playwright-chromium' && c.status === 'error' && (
                  <button
                    className="btn-primary text-xs mt-2"
                    onClick={installChromium}
                    disabled={installing}
                  >
                    {installing ? 'Installing…' : 'Install Chromium'}
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      {installLog.length > 0 && (
        <section className="card mt-4 overflow-hidden border-blue-500/30">
          <div className="px-5 py-3 border-b border-white/5">
            <h2 className="text-sm font-medium">Chromium install progress</h2>
          </div>
          <div className="max-h-[200px] overflow-y-auto bg-ink-900/40 px-5 py-2">
            {installLog.slice(-50).map((l, i) => (
              <div key={i} className="text-[11px] font-mono text-ink-200/80">{l}</div>
            ))}
          </div>
        </section>
      )}

      <section className="card mt-4 overflow-hidden">
        <div className="px-5 py-3 border-b border-white/5 flex items-center justify-between">
          <h2 className="text-sm font-medium">Recent log</h2>
          <span className="text-xs text-ink-200/50 font-mono">
            {logTail?.path ? `${logTail.path} · ${(logTail.size / 1024).toFixed(0)} KB` : 'no log file'}
          </span>
        </div>
        <div className="max-h-[400px] overflow-y-auto bg-ink-900/40">
          {logTail?.entries.length === 0 && (
            <div className="px-5 py-6 text-center text-xs text-ink-200/40">Log is empty.</div>
          )}
          {logTail?.entries.slice().reverse().map((e, i) => (
            <div key={i} className="px-5 py-1.5 text-[11px] font-mono flex gap-3 border-b border-white/5 last:border-0">
              <span className="text-ink-200/40 shrink-0">{e.ts ?? '—'}</span>
              <LogLevel level={e.level} />
              <span className="text-ink-200/80 break-all">{e.text}</span>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function OverallPill({ status }: { status: 'ok' | 'warn' | 'error' | 'info' }) {
  const cls =
    status === 'ok' ? 'bg-emerald-500/20 text-emerald-200 border border-emerald-500/30' :
    status === 'warn' ? 'bg-yellow-500/20 text-yellow-200 border border-yellow-500/30' :
    status === 'error' ? 'bg-red-500/20 text-red-200 border border-red-500/30' :
    'bg-white/10 text-ink-200/70 border border-white/15';
  return <span className={`pill ${cls} uppercase text-[10px] tracking-wide`}>{status}</span>;
}

function StatusPill({ status }: { status: 'ok' | 'warn' | 'error' | 'info' }) {
  const cls =
    status === 'ok' ? 'bg-emerald-500/20 text-emerald-200' :
    status === 'warn' ? 'bg-yellow-500/20 text-yellow-200' :
    status === 'error' ? 'bg-red-500/20 text-red-200' :
    'bg-white/10 text-ink-200/60';
  return <span className={`pill ${cls} text-[10px]`}>{status}</span>;
}

function CheckIcon({ status }: { status: 'ok' | 'warn' | 'error' | 'info' }) {
  if (status === 'ok') return <span className="text-emerald-300 mt-0.5">✓</span>;
  if (status === 'warn') return <span className="text-yellow-300 mt-0.5">!</span>;
  if (status === 'error') return <span className="text-red-300 mt-0.5">✗</span>;
  return <span className="text-ink-200/50 mt-0.5">•</span>;
}

function LogLevel({ level }: { level: string | null }) {
  if (!level) return <span className="text-ink-200/40 w-12 shrink-0">—</span>;
  const cls =
    /error/i.test(level) ? 'text-red-300' :
    /warn/i.test(level) ? 'text-yellow-300' :
    /info/i.test(level) ? 'text-blue-300' :
    'text-ink-200/60';
  return <span className={`${cls} w-12 shrink-0 uppercase`}>{level}</span>;
}
