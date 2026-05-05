// Onboarding overlay v2. State lives in the DB (onboarding_steps table) so
// reinstalls re-prompt and Settings → "Re-run onboarding" works. Steps:
//   welcome → linkedin → salesnav → anthropic → apollo → tam → demo → done
//
// Each step renders an inline status pill (pending / completed / skipped) and
// the user can navigate freely or skip. The Done step is only reachable after
// every other step is completed or skipped.

import { useEffect, useState } from 'react';
import { pushToast } from './Toast';

type StepId = 'welcome' | 'linkedin' | 'salesnav' | 'anthropic' | 'apollo' | 'tam' | 'demo' | 'done';
type StepStatus = 'pending' | 'completed' | 'skipped';

interface StepRow {
  step_id: StepId;
  status: StepStatus;
  completed_at: string | null;
}

const STEP_ORDER: StepId[] = ['welcome', 'linkedin', 'salesnav', 'anthropic', 'apollo', 'tam', 'demo', 'done'];

const STEP_TITLES: Record<StepId, string> = {
  welcome: 'Welcome',
  linkedin: 'LinkedIn login',
  salesnav: 'Sales Nav login',
  anthropic: 'Anthropic API key',
  apollo: 'Apollo connection',
  tam: 'TAM list',
  demo: 'Demo prospects',
  done: 'You\'re set'
};

export default function OnboardingOverlay() {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<StepId>('welcome');
  const [steps, setSteps] = useState<StepRow[]>([]);

  async function refresh() {
    const r = await window.api.getOnboardingState();
    setSteps(r.steps);
    if (!r.complete) {
      setOpen(true);
      // Resume on the first non-completed step.
      const first = r.steps.find((s) => s.status === 'pending');
      if (first && first.step_id !== 'done') setStep(first.step_id);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  // Listen for "re-run onboarding" event from Settings.
  useEffect(() => {
    function onReset() {
      setStep('welcome');
      setOpen(true);
      void refresh();
    }
    window.addEventListener('onboarding:reopen', onReset);
    return () => window.removeEventListener('onboarding:reopen', onReset);
  }, []);

  async function setStepStatus(stepId: StepId, status: StepStatus, meta?: Record<string, unknown>) {
    await window.api.setOnboardingStep(stepId, status, meta);
    await refresh();
  }

  function statusOf(id: StepId): StepStatus {
    return steps.find((s) => s.step_id === id)?.status ?? 'pending';
  }

  function next() {
    const idx = STEP_ORDER.indexOf(step);
    const target = STEP_ORDER[Math.min(idx + 1, STEP_ORDER.length - 1)];
    setStep(target);
  }

  function back() {
    const idx = STEP_ORDER.indexOf(step);
    const target = STEP_ORDER[Math.max(idx - 1, 0)];
    setStep(target);
  }

  async function close() {
    await setStepStatus('done', 'completed');
    setOpen(false);
  }

  async function skipAll() {
    for (const s of STEP_ORDER) {
      if (statusOf(s) === 'pending') await setStepStatus(s, 'skipped');
    }
    await setStepStatus('done', 'completed');
    setOpen(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 bg-ink-900/85 backdrop-blur flex items-center justify-center p-8">
      <div className="card max-w-2xl w-full p-8 border-white/10">
        <Stepper current={step} steps={steps} onPick={setStep} />

        <div className="mt-8">
          {step === 'welcome' && <Welcome onContinue={async () => { await setStepStatus('welcome', 'completed'); next(); }} onSkipAll={skipAll} />}
          {step === 'linkedin' && (
            <LinkedInStep
              status={statusOf('linkedin')}
              onComplete={async () => { await setStepStatus('linkedin', 'completed'); next(); }}
              onSkip={async () => { await setStepStatus('linkedin', 'skipped'); next(); }}
              onBack={back}
            />
          )}
          {step === 'salesnav' && (
            <SalesNavStep
              status={statusOf('salesnav')}
              onComplete={async () => { await setStepStatus('salesnav', 'completed'); next(); }}
              onSkip={async () => { await setStepStatus('salesnav', 'skipped'); next(); }}
              onBack={back}
            />
          )}
          {step === 'anthropic' && (
            <AnthropicStep
              status={statusOf('anthropic')}
              onComplete={async () => { await setStepStatus('anthropic', 'completed'); next(); }}
              onSkip={async () => { await setStepStatus('anthropic', 'skipped'); next(); }}
              onBack={back}
            />
          )}
          {step === 'apollo' && (
            <ApolloStep
              status={statusOf('apollo')}
              onComplete={async (meta) => { await setStepStatus('apollo', 'completed', meta); next(); }}
              onSkip={async () => { await setStepStatus('apollo', 'skipped'); next(); }}
              onBack={back}
            />
          )}
          {step === 'tam' && (
            <TamStep
              status={statusOf('tam')}
              onComplete={async (meta) => { await setStepStatus('tam', 'completed', meta); next(); }}
              onSkip={async () => { await setStepStatus('tam', 'skipped'); next(); }}
              onBack={back}
            />
          )}
          {step === 'demo' && (
            <DemoStep
              status={statusOf('demo')}
              onComplete={async (meta) => { await setStepStatus('demo', 'completed', meta); next(); }}
              onSkip={async () => { await setStepStatus('demo', 'skipped'); next(); }}
              onBack={back}
            />
          )}
          {step === 'done' && <DoneStep onClose={close} steps={steps} />}
        </div>
      </div>
    </div>
  );
}

function Stepper({ current, steps, onPick }: { current: StepId; steps: StepRow[]; onPick: (id: StepId) => void }) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto text-[10px]">
      {STEP_ORDER.map((id) => {
        const status = steps.find((s) => s.step_id === id)?.status ?? 'pending';
        const isCurrent = id === current;
        const dotColor =
          status === 'completed' ? 'bg-emerald-400' :
          status === 'skipped' ? 'bg-yellow-400' :
          isCurrent ? 'bg-blue-400' :
          'bg-ink-200/30';
        return (
          <button
            key={id}
            onClick={() => onPick(id)}
            className={`px-2 py-1 rounded transition-colors flex items-center gap-1.5 ${
              isCurrent ? 'bg-white/10 text-white' : 'text-ink-200/60 hover:bg-white/5'
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
            <span className="uppercase tracking-wider">{STEP_TITLES[id]}</span>
          </button>
        );
      })}
    </div>
  );
}

function Welcome({ onContinue, onSkipAll }: { onContinue: () => void; onSkipAll: () => void }) {
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome to LinkedIn Copilot.</h1>
      <p className="text-ink-200/70 mt-3 text-sm leading-relaxed">
        The agent automates the front-end of LinkedIn outreach end-to-end: prospect research, locked-formula drafting, QA scoring, and Playwright-driven send.
      </p>
      <p className="text-ink-200/70 mt-3 text-sm leading-relaxed">
        Setup takes ~90 seconds. We'll get LinkedIn signed in, optionally Sales Nav (for InMail), drop in your Anthropic key, decide how to use Apollo, import your TAM list, and you'll be ready to send.
      </p>
      <p className="text-ink-200/50 mt-3 text-xs">
        Anything you skip can be filled in later from Settings → Re-run onboarding.
      </p>
      <Footer>
        <button className="btn-ghost" onClick={onSkipAll}>Skip all setup</button>
        <button className="btn-primary" onClick={onContinue}>Start</button>
      </Footer>
    </>
  );
}

function LinkedInStep({ status, onComplete, onSkip, onBack }: { status: StepStatus; onComplete: () => void; onSkip: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function login() {
    setBusy(true);
    setErr(null);
    const r = await window.api.loginLinkedIn();
    setBusy(false);
    if (r.ok) {
      pushToast('success', 'LinkedIn signed in');
      onComplete();
    } else {
      setErr(r.error ?? 'login failed');
    }
  }

  return (
    <>
      <Heading title="Sign into LinkedIn" status={status} />
      <p className="text-ink-200/70 mt-2 text-sm">
        Required for connection-request flow. A separate Chromium window opens — sign in there. Cookies persist across launches; you do this once.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button className="btn-primary" onClick={login} disabled={busy}>
          {busy ? 'Waiting for sign-in…' : status === 'completed' ? '✓ Signed in (re-verify)' : 'Open LinkedIn login'}
        </button>
      </div>
      {err && (
        <div className="mt-4 p-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-100">{err}</div>
      )}
      <Footer>
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-ghost" onClick={onSkip}>Skip</button>
        <button className="btn-primary" onClick={onComplete} disabled={status !== 'completed' && !err}>Continue</button>
      </Footer>
    </>
  );
}

function SalesNavStep({ status, onComplete, onSkip, onBack }: { status: StepStatus; onComplete: () => void; onSkip: () => void; onBack: () => void }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function login() {
    setBusy(true);
    setErr(null);
    const r = await window.api.loginSalesNav();
    setBusy(false);
    if (r.ok) {
      pushToast('success', 'Sales Nav signed in');
      onComplete();
    } else {
      setErr(r.error ?? 'Sales Nav login failed');
    }
  }

  return (
    <>
      <Heading title="Sign into Sales Navigator" status={status} />
      <p className="text-ink-200/70 mt-2 text-sm">
        Sales Nav has its own session that expires independently of regular LinkedIn. Required for the InMail motion. If you only need connection requests, you can skip this for now.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button className="btn-primary" onClick={login} disabled={busy}>
          {busy ? 'Waiting for sign-in…' : status === 'completed' ? '✓ Signed in (re-verify)' : 'Open Sales Nav login'}
        </button>
      </div>
      {err && (
        <div className="mt-4 p-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-100">{err}</div>
      )}
      <Footer>
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-ghost" onClick={onSkip}>Skip (no InMail)</button>
        <button className="btn-primary" onClick={onComplete} disabled={status !== 'completed' && !err}>Continue</button>
      </Footer>
    </>
  );
}

function AnthropicStep({ status, onComplete, onSkip, onBack }: { status: StepStatus; onComplete: () => void; onSkip: () => void; onBack: () => void }) {
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await window.api.setAnthropicKey(key);
    setSaving(false);
    setKey('');
    pushToast('success', 'Anthropic key saved (encrypted at rest)');
    onComplete();
  }

  return (
    <>
      <Heading title="Anthropic API key" status={status} />
      <p className="text-ink-200/70 mt-2 text-sm">
        Powers Sonnet 4.6 (hook generation) and Opus 4.7 (D2/D3 confidence scoring). The app falls back to heuristics if no key is set, but draft quality drops noticeably. Stored encrypted at rest via your OS keychain.
      </p>
      <div className="mt-4 flex items-center gap-2">
        <input
          type="password"
          className="input"
          placeholder="sk-ant-..."
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <button className="btn-primary" onClick={save} disabled={!key || saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
      <Footer>
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-ghost" onClick={onSkip}>Skip (heuristic mode)</button>
        <button className="btn-primary" onClick={onComplete} disabled={status !== 'completed'}>Continue</button>
      </Footer>
    </>
  );
}

function ApolloStep({ status, onComplete, onSkip, onBack }: { status: StepStatus; onComplete: (meta?: Record<string, unknown>) => void; onSkip: () => void; onBack: () => void }) {
  const [mode, setMode] = useState<'auto' | 'api' | 'ui' | 'off'>('auto');
  const [resolved, setResolved] = useState<'api' | 'ui' | 'none'>('none');
  const [reason, setReason] = useState('');
  const [key, setKey] = useState('');

  useEffect(() => {
    void window.api.getApolloMode().then((r) => {
      setMode(r.preference);
      setResolved(r.resolved);
      setReason(r.reason);
    });
  }, []);

  async function changeMode(m: typeof mode) {
    const r = await window.api.setApolloMode(m);
    setMode(r.preference);
    setResolved(r.resolved);
    setReason(r.reason);
  }

  async function saveKey() {
    if (!key) return;
    await window.api.setApolloKey(key);
    setKey('');
    pushToast('success', 'Apollo key saved (encrypted)');
    const r = await window.api.getApolloMode();
    setResolved(r.resolved);
    setReason(r.reason);
  }

  return (
    <>
      <Heading title="Apollo connection" status={status} />
      <p className="text-ink-200/70 mt-2 text-sm">
        Apollo powers Phase 3 dedup (active-campaign check). Pick how to talk to it.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <ModeChoice
          title="Auto (recommended)"
          desc="Use API if a key is set, otherwise drive the Apollo UI via Playwright."
          selected={mode === 'auto'}
          onClick={() => changeMode('auto')}
        />
        <ModeChoice
          title="API only"
          desc="Use the Apollo API. Fast and reliable. Requires a key."
          selected={mode === 'api'}
          onClick={() => changeMode('api')}
        />
        <ModeChoice
          title="UI only"
          desc="Drive https://app.apollo.io via Playwright. Slower, but works without a key."
          selected={mode === 'ui'}
          onClick={() => changeMode('ui')}
        />
        <ModeChoice
          title="Off"
          desc="Skip Phase 3 entirely. Phase 0.6 prior-contact check still runs locally."
          selected={mode === 'off'}
          onClick={() => changeMode('off')}
        />
      </div>

      <div className="mt-4 text-xs text-ink-200/60 flex items-center gap-2">
        <span className={`pill ${resolved === 'api' ? 'bg-emerald-500/20 text-emerald-200' : resolved === 'ui' ? 'bg-blue-500/20 text-blue-200' : 'bg-white/10 text-ink-200/60'}`}>
          resolved: {resolved}
        </span>
        <span>{reason}</span>
      </div>

      {(mode === 'auto' || mode === 'api') && (
        <div className="mt-4">
          <div className="label">Apollo API key (optional in auto mode)</div>
          <div className="flex items-center gap-2">
            <input type="password" className="input" placeholder="apollo-..." value={key} onChange={(e) => setKey(e.target.value)} />
            <button className="btn-primary" onClick={saveKey} disabled={!key}>Save</button>
          </div>
        </div>
      )}

      {(mode === 'auto' && resolved === 'ui') || mode === 'ui' ? (
        <div className="mt-4 p-3 rounded-md border border-blue-500/30 bg-blue-500/5 text-sm">
          <div className="font-medium">Apollo UI mode active</div>
          <p className="text-ink-200/70 mt-1 text-xs">
            Phase 3 will drive <code className="font-mono">app.apollo.io</code> in a browser tab.
            Make sure you're signed in there once — the agent reuses the same Playwright profile.
          </p>
        </div>
      ) : null}

      <Footer>
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-ghost" onClick={onSkip}>Skip</button>
        <button className="btn-primary" onClick={() => onComplete({ mode, resolved })}>Continue</button>
      </Footer>
    </>
  );
}

function ModeChoice({ title, desc, selected, onClick }: { title: string; desc: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`text-left card p-3 transition-colors ${selected ? 'border-accent bg-accent/10' : 'hover:bg-white/5'}`}
    >
      <div className="text-sm font-medium">{title}</div>
      <div className="text-xs text-ink-200/60 mt-1">{desc}</div>
    </button>
  );
}

function TamStep({ status, onComplete, onSkip, onBack }: { status: StepStatus; onComplete: (meta?: Record<string, unknown>) => void; onSkip: () => void; onBack: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function reimport() {
    setBusy(true);
    const r = await window.api.importTam();
    setCount(r.total);
    setBusy(false);
    pushToast('success', `TAM list refreshed: ${r.total} accounts`);
  }

  return (
    <>
      <Heading title="TAM list" status={status} />
      <p className="text-ink-200/70 mt-2 text-sm">
        The seed list (312 TAM + 6 G2) is loaded automatically on first launch. You can re-import any time from Settings, or now.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button className="btn-ghost" onClick={reimport} disabled={busy}>
          {busy ? 'Importing…' : 'Re-import TAM seed'}
        </button>
        {count !== null && <span className="text-sm text-ink-200/70">Total: {count} accounts</span>}
      </div>
      <Footer>
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-ghost" onClick={onSkip}>Skip (use bundled seed)</button>
        <button className="btn-primary" onClick={() => onComplete({ count })}>Continue</button>
      </Footer>
    </>
  );
}

function DemoStep({ status, onComplete, onSkip, onBack }: { status: StepStatus; onComplete: (meta?: Record<string, unknown>) => void; onSkip: () => void; onBack: () => void }) {
  const [count, setCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    const r = await window.api.loadDemoSeeds();
    setCount(r.inserted);
    setBusy(false);
    pushToast('success', r.inserted > 0 ? `Loaded ${r.inserted} demo prospects` : 'Demo prospects already loaded');
  }

  return (
    <>
      <Heading title="Demo prospects" status={status} />
      <p className="text-ink-200/70 mt-2 text-sm">
        Optional. Inserts 3 pre-baked prospects (Rami @ SailPoint, Gabija @ Rocket Software, Barak @ Pathlock) with full evidence and 9.0–9.5/10 drafts. Useful for rehearsal or as a fallback when LinkedIn rate-limits.
      </p>
      <div className="mt-6 flex items-center gap-3">
        <button className="btn-primary" onClick={load} disabled={busy}>
          {busy ? 'Loading…' : 'Load demo prospects'}
        </button>
        {count !== null && <span className="text-sm text-ink-200/70">Inserted: {count}</span>}
      </div>
      <Footer>
        <button className="btn-ghost" onClick={onBack}>Back</button>
        <button className="btn-ghost" onClick={onSkip}>Skip</button>
        <button className="btn-primary" onClick={() => onComplete({ count })}>Continue</button>
      </Footer>
    </>
  );
}

function DoneStep({ onClose, steps }: { onClose: () => void; steps: StepRow[] }) {
  const completed = steps.filter((s) => s.status === 'completed').length;
  const skipped = steps.filter((s) => s.status === 'skipped').length;
  return (
    <>
      <h1 className="text-2xl font-semibold tracking-tight">You're set.</h1>
      <p className="text-ink-200/70 mt-3 text-sm leading-relaxed">
        {completed} step{completed === 1 ? '' : 's'} completed{skipped > 0 ? ` · ${skipped} skipped (you can fill these in any time from Settings)` : ''}.
      </p>
      <p className="text-ink-200/70 mt-3 text-sm leading-relaxed">
        Click "New Outreach" to run your first prospect. Paste a LinkedIn URL, watch the pipeline, review the scored draft, click Approve & Send.
      </p>
      <Footer>
        <button className="btn-primary" onClick={onClose}>Get started</button>
      </Footer>
    </>
  );
}

function Heading({ title, status }: { title: string; status: StepStatus }) {
  return (
    <div className="flex items-center gap-2">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      <span className={`pill text-[10px] ${
        status === 'completed' ? 'bg-emerald-500/20 text-emerald-200' :
        status === 'skipped' ? 'bg-yellow-500/20 text-yellow-200' :
        'bg-white/10 text-ink-200/60'
      }`}>
        {status}
      </span>
    </div>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 flex items-center justify-end gap-2">{children}</div>;
}
