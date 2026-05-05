// Home — workflow-driven view. Replaces flat counters with a stack of action cards
// sourced from analytics:todaysActions IPC.

import { useEffect, useState } from 'react';
import type { TodaysActionsData } from '../../shared/types';

export default function Home({
  onStart,
  onOpenDetail,
  onOpenActivity
}: {
  onStart: () => void;
  onOpenDetail?: (id: number) => void;
  onOpenActivity?: () => void;
}) {
  const [data, setData] = useState<TodaysActionsData | null>(null);

  useEffect(() => {
    let live = true;
    const tick = async () => {
      const r = await window.api.getTodaysActions();
      if (live) setData(r);
    };
    void tick();
    const id = setInterval(tick, 10_000);
    return () => { live = false; clearInterval(id); };
  }, []);

  if (!data) {
    return <div className="p-10 text-ink-200/40 text-sm">Loading…</div>;
  }

  const sendsRemaining = Math.max(0, data.sendsCapSoft - data.sendsToday);
  const totalActions =
    data.pendingReplies.length +
    data.newAccepts.length +
    data.draftsAwaitingReview.length +
    data.recentDrops.length;

  return (
    <div className="p-10 max-w-4xl">
      <h1 className="text-2xl font-semibold tracking-tight">Today.</h1>
      <p className="text-ink-200/60 mt-1 text-sm">
        {totalActions === 0 ? "Inbox zero. Start a new outreach." : "Here's what to handle right now."}
      </p>

      <div className="mt-8 space-y-3">
        {data.dropRate24h.severity === 'alert' && (
          <div className="card border-l-4 border-l-red-400 p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400" />
                  <h3 className="text-sm font-semibold text-red-100">Drop rate is too high</h3>
                </div>
                <p className="text-xs text-ink-200/70 mt-1">
                  {data.dropRate24h.dropped} of {data.dropRate24h.drafted} prospects drafted in the last 24h were dropped ({Math.round(data.dropRate24h.rate * 100)}%).
                  Per the v2 BDR skill, &gt;50% drop rate means the source pool is bad — re-source from a different account or broaden ICP titles, rather than push through.
                </p>
              </div>
              <button
                className="btn-primary text-sm shrink-0"
                onClick={onStart}
                title="Switch to a different TAM account or ICP titles via the New Outreach wizard"
              >
                Re-source
              </button>
            </div>
          </div>
        )}

        {data.dropRate24h.severity === 'warn' && (
          <div className="card border-l-4 border-l-yellow-400 p-3">
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span className="text-xs text-yellow-100">
                Drop rate at {Math.round(data.dropRate24h.rate * 100)}% over the last 24h ({data.dropRate24h.dropped} of {data.dropRate24h.drafted}) — keep an eye on it.
              </span>
            </div>
          </div>
        )}

        {data.pendingReplies.length > 0 && (
          <ActionCard
            kind="reply"
            title={`${data.pendingReplies.length} repl${data.pendingReplies.length === 1 ? 'y' : 'ies'} waiting`}
            desc="Drop into Activity, draft a response, send."
            cta="Open Activity"
            onCta={onOpenActivity}
            items={data.pendingReplies.map((r) => ({
              id: r.id,
              primary: r.full_name,
              secondary: r.company_name ?? '',
              tertiary: `replied ${r.replied_at}`
            }))}
            onItem={onOpenDetail}
          />
        )}

        {data.newAccepts.length > 0 && (
          <ActionCard
            kind="accept"
            title={`${data.newAccepts.length} new accept${data.newAccepts.length === 1 ? '' : 's'}`}
            desc="They connected. Open the thread on LinkedIn and follow up with a DM."
            cta="Open Activity"
            onCta={onOpenActivity}
            items={data.newAccepts.map((r) => ({
              id: r.id,
              primary: r.full_name,
              secondary: r.company_name ?? '',
              tertiary: `accepted ${r.accepted_at}`
            }))}
            onItem={onOpenDetail}
          />
        )}

        {data.draftsAwaitingReview.length > 0 && (
          <ActionCard
            kind="draft"
            title={`${data.draftsAwaitingReview.length} draft${data.draftsAwaitingReview.length === 1 ? '' : 's'} to review`}
            desc="Confidence ≥ 9.0/10. Review, edit if needed, approve & send."
            cta="View all"
            onCta={onOpenActivity}
            items={data.draftsAwaitingReview.map((r) => ({
              id: r.id,
              primary: r.full_name,
              secondary: r.company_name ?? '',
              tertiary: r.confidence ? `${r.confidence.toFixed(1)}/10` : '—'
            }))}
            onItem={onOpenDetail}
          />
        )}

        <SendsCard sendsToday={data.sendsToday} cap={data.sendsCapSoft} remaining={sendsRemaining} onStart={onStart} />

        {data.reEngagement.length > 0 && (
          <ActionCard
            kind="reply"
            title={`${data.reEngagement.length} ready to re-engage`}
            desc="Accepts older than 60 days that never replied, or P1 engaged replies that went silent for 30+ days. Worth a soft re-touch."
            cta="View all"
            onCta={onOpenActivity}
            items={data.reEngagement.map((r) => ({
              id: r.id,
              primary: r.full_name,
              secondary: r.company_name ?? '',
              tertiary: `last touch ${r.lastTouch.slice(0, 10)} · ${r.status}`
            }))}
            onItem={onOpenDetail}
          />
        )}

        {data.recentDrops.length > 0 && (
          <ActionCard
            kind="drop"
            title={`${data.recentDrops.length} drop${data.recentDrops.length === 1 ? '' : 's'} today`}
            desc="Pipeline rejected these. Click to see why; some are auto-recoverable with edit."
            cta="View all"
            onCta={onOpenActivity}
            items={data.recentDrops.map((r) => ({
              id: r.id,
              primary: r.full_name,
              secondary: r.company_name ?? '',
              tertiary: (r.reason ?? '').slice(0, 80)
            }))}
            onItem={onOpenDetail}
          />
        )}

        {totalActions === 0 && (
          <div className="card p-8 text-center">
            <h2 className="text-base font-medium">Nothing in the queue.</h2>
            <p className="text-sm text-ink-200/60 mt-1">Run a new outreach or load demo seeds to populate the app.</p>
            <div className="mt-5 flex items-center justify-center gap-2">
              <button className="btn-primary" onClick={onStart}>New Outreach</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ActionCard({
  kind,
  title,
  desc,
  cta,
  onCta,
  items,
  onItem
}: {
  kind: 'reply' | 'accept' | 'draft' | 'drop';
  title: string;
  desc: string;
  cta: string;
  onCta?: () => void;
  items: Array<{ id: number; primary: string; secondary: string; tertiary: string }>;
  onItem?: (id: number) => void;
}) {
  const accent =
    kind === 'reply' ? 'border-l-purple-400' :
    kind === 'accept' ? 'border-l-emerald-400' :
    kind === 'draft' ? 'border-l-blue-400' :
    'border-l-red-400';
  const dot =
    kind === 'reply' ? 'bg-purple-400' :
    kind === 'accept' ? 'bg-emerald-400' :
    kind === 'draft' ? 'bg-blue-400' :
    'bg-red-400';

  return (
    <div className={`card border-l-4 ${accent} p-5`}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
            <h3 className="text-sm font-semibold">{title}</h3>
          </div>
          <p className="text-xs text-ink-200/60 mt-1">{desc}</p>
        </div>
        {cta && onCta && (
          <button className="btn-ghost text-xs shrink-0" onClick={onCta}>{cta}</button>
        )}
      </div>

      <div className="mt-3 divide-y divide-white/5">
        {items.slice(0, 5).map((it) => (
          <button
            key={it.id}
            onClick={() => onItem?.(it.id)}
            className="w-full text-left py-2 flex items-center gap-3 hover:bg-white/5 px-2 -mx-2 rounded-md transition-colors"
          >
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{it.primary}</div>
              <div className="text-xs text-ink-200/50 truncate">{it.secondary}</div>
            </div>
            <div className="text-xs text-ink-200/60 whitespace-nowrap">{it.tertiary}</div>
          </button>
        ))}
        {items.length > 5 && (
          <div className="pt-2 text-xs text-ink-200/40">+ {items.length - 5} more</div>
        )}
      </div>
    </div>
  );
}

function SendsCard({
  sendsToday,
  cap,
  remaining,
  onStart
}: {
  sendsToday: number;
  cap: number;
  remaining: number;
  onStart: () => void;
}) {
  const pct = Math.min(100, (sendsToday / cap) * 100);
  const color =
    sendsToday >= cap ? 'bg-red-500' :
    sendsToday >= cap - 2 ? 'bg-yellow-500' :
    'bg-emerald-500';
  return (
    <div className="card border-l-4 border-l-blue-400 p-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <h3 className="text-sm font-semibold">Sends today</h3>
          </div>
          <p className="text-xs text-ink-200/60 mt-1">
            {sendsToday} / {cap} connection requests · INC-028 weekly cap protection.
            {remaining > 0
              ? ` ${remaining} remaining today.`
              : ' Cap reached. Override available per-send if you must.'}
          </p>
        </div>
        <button className="btn-primary text-sm shrink-0" onClick={onStart}>New Outreach</button>
      </div>
      <div className="mt-4 h-2 rounded-full bg-white/5 overflow-hidden">
        <div className={`h-full ${color} transition-all duration-300`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
