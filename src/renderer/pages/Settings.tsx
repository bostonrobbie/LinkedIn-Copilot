// Settings — sectioned layout with anchor-scroll navigation. Each section is
// independent so growth doesn't turn the page into a wall of forms.

import { useEffect, useRef, useState } from 'react';
import { pushToast } from '../components/Toast';

type SectionId = 'account' | 'sessions' | 'keys' | 'data' | 'advanced';

const SECTIONS: Array<{ id: SectionId; label: string; desc: string }> = [
  { id: 'account', label: 'Account', desc: 'Display name, email, onboarding' },
  { id: 'sessions', label: 'Sessions', desc: 'LinkedIn + Sales Nav login state' },
  { id: 'keys', label: 'API keys', desc: 'Anthropic + Apollo (encrypted at rest)' },
  { id: 'data', label: 'Data', desc: 'TAM, demo seeds, backups, folders' },
  { id: 'advanced', label: 'Advanced', desc: 'Throttle, factory reset, build info' }
];

export default function Settings() {
  const [active, setActive] = useState<SectionId>('account');
  const refs = useRef<Record<SectionId, HTMLDivElement | null>>({
    account: null,
    sessions: null,
    keys: null,
    data: null,
    advanced: null
  });

  function jump(id: SectionId) {
    setActive(id);
    refs.current[id]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  return (
    <div className="flex">
      <aside className="w-56 shrink-0 border-r border-white/5 sticky top-0 self-start py-8 px-4">
        <div className="text-xs uppercase tracking-wider text-ink-200/40 mb-3">Settings</div>
        <nav className="space-y-1">
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => jump(s.id)}
              className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors ${
                active === s.id ? 'bg-white/10 text-white' : 'text-ink-200/70 hover:bg-white/5'
              }`}
            >
              <div className="font-medium">{s.label}</div>
              <div className="text-[10px] text-ink-200/50 mt-0.5">{s.desc}</div>
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 p-10 max-w-3xl">
        <div ref={(el) => (refs.current.account = el)}>
          <AccountSection />
        </div>
        <div ref={(el) => (refs.current.sessions = el)} className="mt-12">
          <SessionsSection />
        </div>
        <div ref={(el) => (refs.current.keys = el)} className="mt-12">
          <KeysSection />
        </div>
        <div ref={(el) => (refs.current.data = el)} className="mt-12">
          <DataSection />
        </div>
        <div ref={(el) => (refs.current.advanced = el)} className="mt-12 pb-16">
          <AdvancedSection />
        </div>
      </main>
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-4">
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {desc && <p className="text-sm text-ink-200/60 mt-1">{desc}</p>}
    </div>
  );
}

function Card({ title, desc, children }: { title: string; desc?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6 mt-4">
      <h2 className="text-base font-medium">{title}</h2>
      {desc && <p className="text-sm text-ink-200/60 mt-1">{desc}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function AccountSection() {
  const [user, setUser] = useState<{ display_name: string; email: string } | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    void window.api.getCurrentUser().then((u) => {
      if (u) {
        setUser(u);
        setName(u.display_name);
        setEmail(u.email);
      }
    });
  }, []);

  async function save() {
    await window.api.updateUser({ display_name: name, email });
    pushToast('success', 'Account updated');
    setEditing(false);
    const u = await window.api.getCurrentUser();
    if (u) setUser(u);
  }

  async function rerunOnboarding() {
    if (!window.confirm('Reset onboarding state? Your data is unchanged; the welcome flow will run on next reload.')) return;
    await window.api.resetOnboarding();
    pushToast('info', 'Onboarding reset — reload the app to see the wizard.');
    window.dispatchEvent(new Event('onboarding:reopen'));
  }

  return (
    <>
      <SectionHeader title="Account" desc="Your name, email, onboarding state." />
      <Card title="Profile">
        {editing ? (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Display name">
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field label="Email">
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
            </Field>
            <div className="col-span-2 flex justify-end gap-2 mt-2">
              <button className="btn-ghost" onClick={() => { setEditing(false); setName(user?.display_name ?? ''); setEmail(user?.email ?? ''); }}>Cancel</button>
              <button className="btn-primary" onClick={save}>Save</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Display name"><div>{user?.display_name ?? '—'}</div></Field>
            <Field label="Email"><div>{user?.email ?? '—'}</div></Field>
            <div className="col-span-2 flex justify-end mt-2">
              <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
            </div>
          </div>
        )}
      </Card>

      <Card title="Onboarding" desc="Re-run the setup wizard from scratch. Useful if you want to swap in new keys or re-pick Apollo mode.">
        <button className="btn-ghost" onClick={rerunOnboarding}>Re-run onboarding</button>
      </Card>
    </>
  );
}

function SessionsSection() {
  const [li, setLi] = useState<{ state: string; lastObservedAt: string | null } | null>(null);
  const [sn, setSn] = useState<{ state: string; lastObservedAt: string | null } | null>(null);
  const [busyLi, setBusyLi] = useState(false);
  const [busySn, setBusySn] = useState(false);

  async function refresh() {
    const [a, b] = await Promise.all([window.api.getLinkedInStatus(), window.api.getSalesNavStatus()]);
    setLi(a);
    setSn(b);
  }

  useEffect(() => {
    void refresh();
    const id = setInterval(refresh, 8_000);
    return () => clearInterval(id);
  }, []);

  async function loginLi() {
    setBusyLi(true);
    const r = await window.api.loginLinkedIn();
    setBusyLi(false);
    if (r.ok) pushToast('success', 'LinkedIn signed in');
    else pushToast('error', `LinkedIn: ${r.error ?? 'login failed'}`);
    await refresh();
  }

  async function loginSn() {
    setBusySn(true);
    const r = await window.api.loginSalesNav();
    setBusySn(false);
    if (r.ok) pushToast('success', 'Sales Nav signed in');
    else pushToast('error', `Sales Nav: ${r.error ?? 'login failed'}`);
    await refresh();
  }

  return (
    <>
      <SectionHeader title="Sessions" desc="LinkedIn and Sales Navigator have independent sessions; both can expire." />
      <Card title="LinkedIn" desc="Required for connection-request flow.">
        <SessionRow status={li?.state ?? 'unknown'} lastObservedAt={li?.lastObservedAt ?? null} busy={busyLi} onLogin={loginLi} />
      </Card>
      <Card title="Sales Navigator" desc="Required for the InMail motion. If you only run connection requests you can leave this disconnected.">
        <SessionRow status={sn?.state ?? 'unknown'} lastObservedAt={sn?.lastObservedAt ?? null} busy={busySn} onLogin={loginSn} />
      </Card>
    </>
  );
}

function SessionRow({ status, lastObservedAt, busy, onLogin }: { status: string; lastObservedAt: string | null; busy: boolean; onLogin: () => void }) {
  const cls =
    status === 'logged-in' ? 'bg-emerald-500/20 text-emerald-200' :
    status === 'logged-out' || status === 'error' ? 'bg-red-500/20 text-red-200' :
    'bg-white/10 text-ink-200/60';
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-3 text-sm">
        <span className={`pill text-[10px] ${cls}`}>{status}</span>
        {lastObservedAt && <span className="text-xs text-ink-200/50">last seen {new Date(lastObservedAt).toLocaleString()}</span>}
      </div>
      <button className="btn-primary text-sm" onClick={onLogin} disabled={busy}>
        {busy ? 'Waiting…' : status === 'logged-in' ? 'Re-verify' : 'Open login'}
      </button>
    </div>
  );
}

function KeysSection() {
  const [anth, setAnth] = useState<{ configured: boolean; lastFour: string | null } | null>(null);
  const [apollo, setApollo] = useState<{ configured: boolean; lastFour: string | null } | null>(null);
  const [anthVal, setAnthVal] = useState('');
  const [apolloVal, setApolloVal] = useState('');
  const [mode, setMode] = useState<{ preference: string; resolved: string; reason: string } | null>(null);

  async function refresh() {
    const [a, p, m] = await Promise.all([
      window.api.getAnthropicKeyStatus(),
      window.api.getApolloKeyStatus(),
      window.api.getApolloMode()
    ]);
    setAnth(a);
    setApollo(p);
    setMode(m);
  }
  useEffect(() => { void refresh(); }, []);

  async function saveAnth() {
    await window.api.setAnthropicKey(anthVal);
    setAnthVal('');
    pushToast('success', 'Anthropic key saved (encrypted)');
    await refresh();
  }
  async function clearAnth() {
    await window.api.setAnthropicKey('');
    pushToast('info', 'Anthropic key cleared');
    await refresh();
  }
  async function saveApollo() {
    await window.api.setApolloKey(apolloVal);
    setApolloVal('');
    pushToast('success', 'Apollo key saved (encrypted)');
    await refresh();
  }
  async function clearApollo() {
    await window.api.setApolloKey('');
    pushToast('info', 'Apollo key cleared');
    await refresh();
  }
  async function setApolloMode(m: 'auto' | 'api' | 'ui' | 'off') {
    const r = await window.api.setApolloMode(m);
    setMode(r);
    pushToast('info', `Apollo mode: ${r.preference} → resolved ${r.resolved}`);
  }

  return (
    <>
      <SectionHeader title="API keys" desc="Keys are encrypted at rest via your OS keychain. Stored in users.*_enc as opaque blobs." />

      <Card title="Anthropic API key" desc="Powers Sonnet (hooks) and Opus (D2/D3 scoring). Heuristic fallback if unset.">
        <KeyEditor
          status={anth}
          value={anthVal}
          setValue={setAnthVal}
          onSave={saveAnth}
          onClear={clearAnth}
          placeholder="sk-ant-..."
          onCheck={() => window.api.checkAnthropicKey()}
        />
      </Card>

      <Card title="Apollo" desc="Phase 3 dedup. Pick how the agent talks to Apollo.">
        <div className="grid grid-cols-2 gap-2">
          {(['auto', 'api', 'ui', 'off'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setApolloMode(m)}
              className={`text-left card p-3 transition-colors ${mode?.preference === m ? 'border-accent bg-accent/10' : 'hover:bg-white/5'}`}
            >
              <div className="text-sm font-medium uppercase">{m}</div>
              <div className="text-xs text-ink-200/60 mt-1">
                {m === 'auto' && 'API if key set, else UI automation.'}
                {m === 'api' && 'Use Apollo /v1/people/match. Fast.'}
                {m === 'ui' && 'Drive app.apollo.io via Playwright.'}
                {m === 'off' && 'Skip Phase 3 entirely.'}
              </div>
            </button>
          ))}
        </div>
        {mode && (
          <div className="mt-3 text-xs text-ink-200/60 flex items-center gap-2">
            <span className={`pill text-[10px] ${
              mode.resolved === 'api' ? 'bg-emerald-500/20 text-emerald-200' :
              mode.resolved === 'ui' ? 'bg-blue-500/20 text-blue-200' :
              'bg-white/10 text-ink-200/60'
            }`}>resolved: {mode.resolved}</span>
            <span>{mode.reason}</span>
          </div>
        )}

        <div className="mt-5">
          <div className="label">Apollo API key</div>
          <KeyEditor
            status={apollo}
            value={apolloVal}
            setValue={setApolloVal}
            onSave={saveApollo}
            onClear={clearApollo}
            placeholder="apollo-..."
            onCheck={() => window.api.checkApolloKey()}
          />
        </div>
      </Card>
    </>
  );
}

function KeyEditor({
  status,
  value,
  setValue,
  onSave,
  onClear,
  placeholder,
  onCheck
}: {
  status: { configured: boolean; lastFour: string | null } | null;
  value: string;
  setValue: (s: string) => void;
  onSave: () => void;
  onClear: () => void;
  placeholder: string;
  onCheck?: () => Promise<{ ok: boolean; status: string; detail: string; httpStatus?: number }>;
}) {
  const [show, setShow] = useState(false);
  const [checking, setChecking] = useState(false);
  const [check, setCheck] = useState<{ ok: boolean; status: string; detail: string } | null>(null);

  async function runCheck() {
    if (!onCheck) return;
    setChecking(true);
    setCheck(null);
    const r = await onCheck();
    setChecking(false);
    setCheck({ ok: r.ok, status: r.status, detail: r.detail });
  }

  return (
    <>
      <div className="text-sm text-ink-200/70 mb-2 flex items-center gap-2">
        {status?.configured ? (
          <>Configured · ends in <span className="font-mono text-ink-100">…{status.lastFour}</span></>
        ) : (
          <span className="text-yellow-200/80">Not configured</span>
        )}
        {check && (
          <span className={`pill text-[10px] ${
            check.ok && check.status === 'valid' ? 'bg-emerald-500/20 text-emerald-200' :
            check.ok && check.status === 'rate-limited' ? 'bg-yellow-500/20 text-yellow-200' :
            check.status === 'not-configured' ? 'bg-white/10 text-ink-200/60' :
            'bg-red-500/20 text-red-200'
          }`} title={check.detail}>
            {check.status}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <input
          type={show ? 'text' : 'password'}
          className="input font-mono"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className="btn-ghost text-xs" onClick={() => setShow(!show)} title={show ? 'Hide' : 'Show'}>
          {show ? 'Hide' : 'Show'}
        </button>
        <button className="btn-primary" onClick={onSave} disabled={!value}>Save</button>
        {status?.configured && <button className="btn-ghost" onClick={onClear}>Clear</button>}
      </div>
      {onCheck && status?.configured && (
        <div className="mt-2">
          <button className="btn-ghost text-xs" onClick={runCheck} disabled={checking}>
            {checking ? 'Checking…' : 'Check key health'}
          </button>
          {check && check.detail && (
            <div className={`text-xs mt-1 ${check.ok ? 'text-ink-200/60' : 'text-red-200/80'}`}>{check.detail}</div>
          )}
        </div>
      )}
    </>
  );
}

function DataSection() {
  const [tamCount, setTamCount] = useState<number | null>(null);
  const [demoMsg, setDemoMsg] = useState<string | null>(null);
  const [folders, setFolders] = useState<{ userData: string; backups: string; profile: string; logsDir: string } | null>(null);
  const [backups, setBackups] = useState<Array<{ name: string; size: number; createdAt: string }>>([]);

  async function refreshFolders() {
    const f = await window.api.getDataFolders();
    setFolders({ userData: f.userData, backups: f.backups, profile: f.profile, logsDir: f.logsDir });
  }
  async function refreshBackups() {
    const b = await window.api.listBackups();
    setBackups(b);
  }
  useEffect(() => { void refreshFolders(); void refreshBackups(); }, []);

  async function reimportTam() {
    const r = await window.api.importTam();
    setTamCount(r.total);
    pushToast('success', `TAM re-imported: ${r.total} accounts`);
  }
  async function loadDemo() {
    const r = await window.api.loadDemoSeeds();
    setDemoMsg(r.inserted > 0 ? `Inserted ${r.inserted} demo prospects` : 'Demo prospects already loaded');
  }
  async function open(kind: 'userData' | 'backups' | 'profile' | 'logs') {
    const r = await window.api.openFolder(kind);
    if (!r.ok) pushToast('error', `Open folder failed: ${r.error}`);
  }
  async function createBackup() {
    const r = await window.api.createBackup();
    if (r.ok) {
      pushToast('success', `Backup created: ${r.entry?.name}`);
      await refreshBackups();
    } else {
      pushToast('error', r.error ?? 'backup failed');
    }
  }
  async function restore(name: string) {
    if (!window.confirm(`Restore from ${name}?\n\nA pre-restore snapshot is taken automatically. The app will reload immediately after restore so the new DB takes effect.`)) return;
    const r = await window.api.restoreBackup(name);
    if (r.ok) {
      pushToast('success', `Restored. Pre-restore backup: ${r.preRestoreBackup ?? 'n/a'}. Reloading…`);
      // Brief delay so the toast shows before reload kicks the renderer.
      setTimeout(() => window.location.reload(), 800);
    } else {
      pushToast('error', `Restore failed: ${r.error}`);
    }
  }
  async function deleteBackup(name: string) {
    if (!window.confirm(`Delete ${name}?`)) return;
    await window.api.deleteBackup(name);
    await refreshBackups();
  }

  return (
    <>
      <SectionHeader title="Data" desc="Seed data, demo prospects, backups, and where everything lives on disk." />

      <Card title="TAM list" desc="Seeded from BDR/tam-accounts-mar26.csv. Re-import to refresh.">
        <div className="flex items-center gap-3 text-sm">
          <button className="btn-ghost" onClick={reimportTam}>Re-import TAM</button>
          {tamCount !== null && <span className="text-ink-200/70">{tamCount} accounts</span>}
        </div>
      </Card>

      <Card title="Demo prospects" desc="3 pre-baked prospects with full evidence. Useful for rehearsal.">
        <div className="flex items-center gap-3 text-sm">
          <button className="btn-ghost" onClick={loadDemo}>Load demo prospects</button>
          {demoMsg && <span className="text-ink-200/70">{demoMsg}</span>}
        </div>
      </Card>

      <Card title="Backups" desc="Auto-backup runs daily; max 20 kept (oldest auto-pruned). Pre-destructive snapshot taken before every restore.">
        <div className="flex items-center gap-3 text-sm">
          <button className="btn-primary" onClick={createBackup}>Create backup now</button>
          <button className="btn-ghost" onClick={() => open('backups')}>Open backups folder</button>
        </div>
        {backups.length > 0 && (
          <div className="card mt-3 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-ink-200/50 border-b border-white/5">
                  <th className="px-3 py-2">When</th>
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Size</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {backups.map((b) => (
                  <tr key={b.name} className="border-b border-white/5 last:border-0">
                    <td className="px-3 py-2 text-xs text-ink-200/60 font-mono">{b.createdAt.slice(0, 19).replace('T', ' ')}</td>
                    <td className="px-3 py-2 text-xs font-mono text-ink-200/80">{b.name}</td>
                    <td className="px-3 py-2 text-xs text-ink-200/60">{(b.size / 1024).toFixed(1)} KB</td>
                    <td className="px-3 py-2 text-right">
                      <button className="btn-ghost text-xs mr-1" onClick={() => restore(b.name)}>Restore</button>
                      <button className="btn-ghost text-xs text-red-200/80" onClick={() => deleteBackup(b.name)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card title="On-disk paths" desc="Open the OS file explorer at the relevant folder. Useful for collecting logs / sharing backups.">
        <div className="space-y-2 text-sm">
          {folders && (
            <>
              <FolderRow label="App data" path={folders.userData} onOpen={() => open('userData')} />
              <FolderRow label="Backups" path={folders.backups} onOpen={() => open('backups')} />
              <FolderRow label="Playwright profile" path={folders.profile} onOpen={() => open('profile')} />
              <FolderRow label="Logs" path={folders.logsDir} onOpen={() => open('logs')} />
            </>
          )}
        </div>
      </Card>
    </>
  );
}

function FolderRow({ label, path, onOpen }: { label: string; path: string; onOpen: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/5 last:border-0">
      <div>
        <div className="text-sm">{label}</div>
        <div className="text-xs text-ink-200/50 font-mono break-all">{path}</div>
      </div>
      <button className="btn-ghost text-xs" onClick={onOpen}>Open</button>
    </div>
  );
}

function AdvancedSection() {
  return (
    <>
      <SectionHeader title="Advanced" desc="Throttle overrides, factory reset, build info." />
      <Card title="Send throttle (INC-028)" desc="Connection-request soft cap is 10/day, hard cap is 20/day. 7-day rolling cap is 80/100. The header banner pill turns yellow at 8 and red at 10.">
        <div className="text-sm text-ink-200/70">Override is read-only in the MVP. To change, edit `INC_028_SOFT_CAP` / `INC_028_HARD_CAP` in <span className="font-mono text-xs">src/main/agent/sending.ts</span>.</div>
      </Card>

      <Card title="INC-028 cooldown" desc="When the pre-send control-profile probe detects a 4-of-4 sample with no Connect button, a 7-day cooldown is automatically set to prevent further attempts during the LinkedIn rolling-window block.">
        <CooldownControls />
      </Card>

      <Card title="Build info">
        <div className="text-sm space-y-1 font-mono text-xs text-ink-200/70">
          <div>App: LinkedIn Copilot v0.1.0</div>
          <div>Schema migrations: 4 registered</div>
          <div>Renderer: React 18 + Tailwind</div>
          <div>Main: Electron 33 + better-sqlite3 + Playwright + Anthropic SDK + zod</div>
        </div>
      </Card>

      <Card title="Factory reset" desc="Wipe all local data: prospects, outreach, evidence, gate log, send queue, backups. Onboarding re-runs on next launch. NOT recoverable.">
        <FactoryReset />
      </Card>
    </>
  );
}

function CooldownControls() {
  const [state, setState] = useState<{ active: boolean; until?: string; hoursLeft?: number; meta?: Record<string, unknown> } | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setState(await window.api.getCooldown());
  }
  useEffect(() => { void refresh(); }, []);

  async function clear() {
    if (!window.confirm('Clear the INC-028 cooldown? Only do this if you\'re confident the rate-limit probe was a false positive (e.g., the control profile changed connection state).')) return;
    setBusy(true);
    await window.api.clearCooldown();
    setBusy(false);
    pushToast('info', 'Cooldown cleared');
    await refresh();
  }

  if (!state) return <div className="text-xs text-ink-200/40">Loading…</div>;
  if (!state.active) {
    return <div className="text-sm text-ink-200/70">No cooldown active. Sends will proceed normally.</div>;
  }
  const reason = (state.meta as { reason?: string } | undefined)?.reason ?? 'rate-limit detected';
  return (
    <div className="space-y-3 text-sm">
      <div className="text-red-200">
        Cooldown ACTIVE until <span className="font-mono">{state.until}</span> ({state.hoursLeft}h remaining)
      </div>
      <div className="text-xs text-ink-200/60">Reason: {reason}</div>
      <button className="btn-ghost text-xs text-red-200" onClick={clear} disabled={busy}>
        Clear cooldown
      </button>
    </div>
  );
}

function FactoryReset() {
  const [confirm, setConfirm] = useState('');
  const phrase = 'factory reset';
  return (
    <div className="space-y-3 text-sm">
      <div className="text-yellow-200/80 text-xs">
        Type <span className="font-mono text-yellow-100">{phrase}</span> below and click the red button. A pre-reset backup is created automatically.
      </div>
      <div className="flex items-center gap-2">
        <input className="input max-w-xs" placeholder={phrase} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        <button
          className="btn-danger"
          disabled={confirm !== phrase}
          onClick={async () => {
            const b = await window.api.createBackup();
            pushToast('info', `Pre-reset backup created: ${b.entry?.name}. Factory reset is currently a manual op — close the app and delete userData. (Auto-wipe is intentionally not implemented in MVP.)`);
          }}
        >
          Factory reset
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="label">{label}</div>
      {children}
    </div>
  );
}
