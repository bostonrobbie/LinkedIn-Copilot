// Vertical stepper visualization of the orchestrator pipeline. Replaces the
// raw event log on the wizard's "running" step. Each phase has an explicit
// state (idle / active / pass / drop / warn / error) derived from the event
// stream so the user sees agent progress, not just text.

import type { OrchestratorEvent } from '../../shared/types';

interface PhaseDef {
  id: string;
  label: string;
  desc: string;
}

const PHASES: PhaseDef[] = [
  { id: 'research', label: 'Profile capture', desc: 'Read live LinkedIn (name, headline, degree, activity)' },
  { id: '0.5', label: 'Phase 0.5 — DNC', desc: 'Cross-check Do-Not-Contact list' },
  { id: '0.6', label: 'Phase 0.6 — prior contact', desc: 'Cross-check MASTER_SENT_LIST seed + app history' },
  { id: '1.5', label: 'Phase 1.5 — TAM scope', desc: 'Verify company is in TAM / Factor / G2' },
  { id: '0.7', label: 'Phase 0.7 — degree + auto-drop', desc: '1st-degree drops to DM batch; auto-drop signals (Retired / Open to Work / Ex- / etc.)' },
  { id: '0.7.5', label: 'Phase 0.7.5 — deliverability', desc: 'INC-030: drop near-empty profiles' },
  { id: '3', label: 'Phase 3 — Apollo dedup', desc: 'Active-campaign check (stub when no API key)' },
  { id: 'drafting', label: 'Drafting', desc: 'LLM hook (or heuristic) → locked formula' },
  { id: '7.5', label: 'Phase 7.5 — confidence', desc: 'D1 deterministic + D2/D3 LLM. Floor 9.0/10.' }
];

type PhaseState = 'idle' | 'active' | 'pass' | 'drop' | 'warn' | 'error';

function deriveState(events: OrchestratorEvent[]): Record<string, PhaseState> {
  const out: Record<string, PhaseState> = Object.fromEntries(PHASES.map((p) => [p.id, 'idle']));
  let activeId: string | null = null;
  for (const e of events) {
    if (e.kind === 'phase_started' && e.phase) {
      activeId = e.phase;
      if (out[e.phase] === 'idle') out[e.phase] = 'active';
    } else if (e.kind === 'phase_finished' && e.phase) {
      if (out[e.phase] === 'active') out[e.phase] = 'pass';
    } else if (e.kind === 'gate_decision' && e.phase) {
      const decision = (e.payload as { decision?: string } | undefined)?.decision ?? 'pass';
      out[e.phase] = decision === 'drop' ? 'drop' : decision === 'warn' ? 'warn' : 'pass';
    } else if (e.kind === 'evidence_captured') {
      out['research'] = 'pass';
    } else if (e.kind === 'draft_ready') {
      out['drafting'] = 'pass';
    } else if (e.kind === 'qa_finished') {
      out['7.5'] = (e.payload as { pass?: boolean } | undefined)?.pass ? 'pass' : 'drop';
    } else if (e.kind === 'error') {
      if (activeId && out[activeId] !== 'pass') out[activeId] = 'error';
    } else if (e.kind === 'auth_required') {
      // Session expired mid-pipeline — research phase pauses while user re-logs.
      out['research'] = 'warn';
    }
  }
  return out;
}

export default function PipelineProgress({ events }: { events: OrchestratorEvent[] }) {
  const state = deriveState(events);
  const reasonByPhase: Record<string, string | undefined> = {};
  for (const e of events) {
    if (e.kind === 'gate_decision' && e.phase) reasonByPhase[e.phase] = e.message;
    if (e.kind === 'error') reasonByPhase['research'] = e.message;
  }
  const lastEventTs = events.length > 0 ? events[events.length - 1].ts : null;

  return (
    <div className="card p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-base font-medium">Pipeline</h2>
        {lastEventTs && (
          <div className="text-xs text-ink-200/40 font-mono">
            last event {new Date(lastEventTs).toLocaleTimeString([], { hour12: false })}
          </div>
        )}
      </div>

      <ol className="mt-6 space-y-4">
        {PHASES.map((p) => {
          const s = state[p.id];
          return (
            <li key={p.id} className="flex items-start gap-4">
              <div className="shrink-0 w-6 h-6 mt-0.5">
                <PhaseIcon state={s} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-medium ${labelColor(s)}`}>{p.label}</span>
                  {s !== 'idle' && <PhasePill state={s} />}
                </div>
                <div className="text-xs text-ink-200/50 mt-0.5">{p.desc}</div>
                {reasonByPhase[p.id] && s !== 'pass' && (
                  <div className={`text-xs mt-1 ${reasonColor(s)}`}>{reasonByPhase[p.id]}</div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function PhaseIcon({ state }: { state: PhaseState }) {
  if (state === 'idle') {
    return <div className="w-6 h-6 rounded-full border border-ink-200/20 bg-ink-900/40" />;
  }
  if (state === 'active') {
    return (
      <div className="w-6 h-6 rounded-full border-2 border-blue-400 flex items-center justify-center">
        <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
      </div>
    );
  }
  if (state === 'pass') {
    return (
      <div className="w-6 h-6 rounded-full bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center text-xs text-emerald-200">
        ✓
      </div>
    );
  }
  if (state === 'drop') {
    return (
      <div className="w-6 h-6 rounded-full bg-red-500/30 border border-red-400/50 flex items-center justify-center text-xs text-red-200">
        ✗
      </div>
    );
  }
  if (state === 'warn') {
    return (
      <div className="w-6 h-6 rounded-full bg-yellow-500/30 border border-yellow-400/50 flex items-center justify-center text-xs text-yellow-200">
        !
      </div>
    );
  }
  return (
    <div className="w-6 h-6 rounded-full bg-red-500/40 border border-red-400/60 flex items-center justify-center text-xs text-red-100">
      ⚠
    </div>
  );
}

function PhasePill({ state }: { state: PhaseState }) {
  const cls =
    state === 'pass'
      ? 'bg-emerald-500/20 text-emerald-200'
      : state === 'drop'
        ? 'bg-red-500/20 text-red-200'
        : state === 'warn'
          ? 'bg-yellow-500/20 text-yellow-200'
          : state === 'error'
            ? 'bg-red-500/30 text-red-100'
            : 'bg-blue-500/20 text-blue-200';
  return <span className={`pill text-[10px] ${cls}`}>{state}</span>;
}

function labelColor(state: PhaseState): string {
  if (state === 'idle') return 'text-ink-200/40';
  if (state === 'pass') return 'text-emerald-100';
  if (state === 'drop') return 'text-red-200';
  if (state === 'warn') return 'text-yellow-100';
  if (state === 'error') return 'text-red-100';
  return 'text-ink-100';
}

function reasonColor(state: PhaseState): string {
  if (state === 'drop') return 'text-red-200/80';
  if (state === 'warn') return 'text-yellow-200/80';
  if (state === 'error') return 'text-red-200/80';
  return 'text-ink-200/60';
}
