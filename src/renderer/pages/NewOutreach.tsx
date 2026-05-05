import { useEffect, useState } from 'react';
import type { Motion, OrchestratorEvent, OrchestratorResult, OutreachDetail } from '../../shared/types';
import { pushToast } from '../components/Toast';
import PipelineProgress from '../components/PipelineProgress';
import { normalizeBulkUrls } from '../../shared/url';

type Step = 'motion' | 'mode' | 'source' | 'running' | 'review' | 'sent';
type Mode = 'single' | 'bulk' | 'batch';

interface AutoCandidate {
  apolloId: string;
  name: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
  email?: string;
  preScreen: { pass: boolean; reasons: string[] };
}

interface BulkRow {
  url: string;
  status: 'pending' | 'running' | 'pass' | 'drop' | 'error';
  outreachId?: number;
  reason?: string;
  confidence?: number;
}

export default function NewOutreach({ onDone }: { onDone: () => void }) {
  const [step, setStep] = useState<Step>('motion');
  const [motion, setMotion] = useState<Motion>('connection_request');
  const [mode, setMode] = useState<Mode>('single');
  const [profileUrl, setProfileUrl] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [bulkRows, setBulkRows] = useState<BulkRow[]>([]);
  const [accounts, setAccounts] = useState<Array<{ id: number; name: string; tier: string; prospect_count: number }>>([]);
  const [accountQuery, setAccountQuery] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<number | null>(null);
  const [autoCandidates, setAutoCandidates] = useState<AutoCandidate[]>([]);
  const [autoSelected, setAutoSelected] = useState<Set<string>>(new Set());
  const [autoSourcing, setAutoSourcing] = useState(false);
  const [autoError, setAutoError] = useState<string | null>(null);

  useEffect(() => {
    if (mode !== 'batch') return;
    void window.api.listAccounts().then((rows) => setAccounts(rows.map((r) => ({ id: r.id, name: r.name, tier: r.tier, prospect_count: r.prospect_count }))));
  }, [mode]);

  async function sourceCandidates() {
    if (!selectedAccountId) return;
    setAutoSourcing(true);
    setAutoError(null);
    setAutoCandidates([]);
    setAutoSelected(new Set());
    const r = await window.api.sourceFromAccount({ accountId: selectedAccountId, perPage: 25 });
    setAutoSourcing(false);
    if (!r.ok) {
      setAutoError(r.error ?? 'Apollo sourcing failed');
      return;
    }
    setAutoCandidates(r.candidates);
    // Pre-select all clean candidates by default.
    setAutoSelected(new Set(r.candidates.filter((c) => c.preScreen.pass && c.linkedinUrl).map((c) => c.apolloId)));
    if (r.candidates.length === 0) {
      setAutoError(`No Apollo people matched at ${r.account.name}. Try broadening titles.`);
    }
  }

  async function runBatch() {
    const selected = autoCandidates.filter((c) => autoSelected.has(c.apolloId) && c.linkedinUrl);
    if (selected.length === 0) {
      pushToast('error', 'Select at least one candidate.');
      return;
    }
    setBulkRows(selected.map((c) => ({ url: c.linkedinUrl as string, status: 'pending' as const })));
    setStep('running');
    setEvents([]);

    let passed = 0;
    let dropped = 0;
    for (let i = 0; i < selected.length; i++) {
      const c = selected[i];
      setBulkRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'running' } : r)));
      setEvents([]);
      try {
        const out = await window.api.runSingle({
          user_id: 1,
          motion,
          source: { kind: 'linkedin_url', url: c.linkedinUrl as string }
        });
        const status = out.success ? 'pass' : 'drop';
        if (out.success) passed++;
        else dropped++;
        setBulkRows((prev) =>
          prev.map((r, j) =>
            j === i
              ? { ...r, status, outreachId: out.outreach_id, reason: out.drop_reason, confidence: out.draft?.confidence?.overall }
              : r
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setBulkRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'error', reason: msg } : r)));
      }
    }
    pushToast('success', `Auto-prospect done: ${passed} pass / ${dropped} drop / ${selected.length} total`);
  }
  const [events, setEvents] = useState<OrchestratorEvent[]>([]);
  const [result, setResult] = useState<OrchestratorResult | null>(null);
  const [detail, setDetail] = useState<OutreachDetail | null>(null);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [pipelineErr, setPipelineErr] = useState<string | null>(null);

  useEffect(() => {
    const off = window.api.onOrchestratorEvent((e) => {
      setEvents((prev) => [...prev, e]);
      // Auto-recover on session expiry: kick the LinkedIn login flow so the
      // orchestrator's waitForLogin poll resolves.
      if (e.kind === 'auth_required') {
        pushToast('error', 'LinkedIn session expired — opening login window');
        void window.api.loginLinkedIn().then((r) => {
          if (r.ok) pushToast('success', 'LinkedIn signed in — pipeline resuming');
          else pushToast('error', `LinkedIn login failed: ${r.error ?? 'timed out'}`);
        });
      }
    });
    return off;
  }, []);

  async function runPipeline() {
    setEvents([]);
    setResult(null);
    setDetail(null);
    setPipelineErr(null);
    setStep('running');
    try {
      const out = await window.api.runSingle({
        user_id: 1,
        motion,
        source: { kind: 'linkedin_url', url: profileUrl }
      });
      setResult(out);
      if (out.outreach_id) {
        const d = await window.api.getOutreachDetail(out.outreach_id);
        setDetail(d);
      }
      setStep('review');
      if (!out.success) {
        pushToast('error', out.drop_reason ?? 'pipeline dropped this prospect');
      } else {
        pushToast('success', `Draft ready · ${out.draft?.confidence?.overall.toFixed(1)}/10`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setPipelineErr(msg);
      pushToast('error', `Pipeline error: ${msg}`);
      setStep('source');
    }
  }

  async function runBulk() {
    const normalized = normalizeBulkUrls(bulkText);
    if (normalized.valid.length === 0) {
      const reasons = normalized.invalid.length > 0
        ? `\n\nInvalid lines:\n${normalized.invalid.slice(0, 5).map((i) => `• ${i.sourceLine.slice(0, 60)} — ${i.reason}`).join('\n')}`
        : '';
      pushToast('error', `No valid LinkedIn URLs found.${reasons}`);
      return;
    }
    if (normalized.invalid.length > 0 || normalized.duplicatesRemoved > 0) {
      pushToast('info', `${normalized.valid.length} valid · ${normalized.duplicatesRemoved} duplicate${normalized.duplicatesRemoved === 1 ? '' : 's'} removed · ${normalized.invalid.length} invalid skipped`);
    }
    const urls = normalized.valid.map((v) => v.canonical);
    setBulkRows(urls.map((url) => ({ url, status: 'pending' as const })));
    setStep('running');
    setEvents([]);

    let passed = 0;
    let dropped = 0;
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      setBulkRows((prev) => prev.map((r, j) => (j === i ? { ...r, status: 'running' } : r)));
      setEvents([]);
      try {
        const out = await window.api.runSingle({
          user_id: 1,
          motion,
          source: { kind: 'linkedin_url', url }
        });
        const status = out.success ? 'pass' : 'drop';
        if (out.success) passed++;
        else dropped++;
        setBulkRows((prev) =>
          prev.map((r, j) =>
            j === i
              ? {
                  ...r,
                  status,
                  outreachId: out.outreach_id,
                  reason: out.drop_reason,
                  confidence: out.draft?.confidence?.overall
                }
              : r
          )
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setBulkRows((prev) =>
          prev.map((r, j) => (j === i ? { ...r, status: 'error', reason: msg } : r))
        );
      }
    }
    pushToast('success', `Bulk done: ${passed} pass / ${dropped} drop / ${urls.length} total`);
    // Stay on running step — the user reviews the bulk results inline.
  }

  async function approve(overrideSoftCap = false) {
    if (!result?.outreach_id) return;
    setSending(true);
    setSendErr(null);
    const r = await window.api.approveAndSend(result.outreach_id, overrideSoftCap ? { overrideSoftCap: true } : undefined);
    setSending(false);
    if (!r.ok) {
      // INC-028 soft-cap path — offer override.
      if (r.throttle && r.throttle.cap === 10 && !overrideSoftCap) {
        const ok = window.confirm(
          `INC-028: ${r.throttle.dailyCount} connection requests already sent today (recommended ≤${r.throttle.cap}).\n\nOverride and send anyway?`
        );
        if (ok) return approve(true);
      }
      setSendErr(r.error ?? 'send failed');
      pushToast('error', `Send failed: ${r.error ?? 'unknown'}`);
      return;
    }
    pushToast('success', 'Sent.');
    setStep('sent');
  }

  async function simulate() {
    if (!result?.outreach_id) return;
    setSending(true);
    const r = await window.api.simulateSend(result.outreach_id);
    setSending(false);
    if (!r.ok) {
      setSendErr('simulate failed (status not draft)');
      return;
    }
    pushToast('info', 'Simulated send (no LinkedIn action taken)');
    setStep('sent');
  }

  function reset() {
    setStep('motion');
    setProfileUrl('');
    setEvents([]);
    setResult(null);
    setDetail(null);
    setSendErr(null);
    setPipelineErr(null);
  }

  return (
    <div className="p-10 max-w-3xl">
      <Stepper step={step} />

      {step === 'motion' && (
        <Question title="What kind of outreach?" subtitle="Pick one to start.">
          <Choice
            title="LinkedIn Connection Request"
            desc="Send a personalized invite with a 300-char note. Free."
            selected={motion === 'connection_request'}
            onClick={() => setMotion('connection_request')}
          />
          <Choice
            title="Sales Navigator InMail"
            desc="Direct InMail to anyone (2nd/3rd-degree). Costs an InMail credit."
            selected={motion === 'sales_nav_inmail'}
            onClick={() => setMotion('sales_nav_inmail')}
          />
          <Footer>
            <button className="btn-primary" onClick={() => setStep('mode')}>Continue</button>
          </Footer>
        </Question>
      )}

      {step === 'mode' && (
        <Question title="Single prospect or bulk?">
          <Choice
            title="Single prospect"
            desc="Paste one LinkedIn URL. Full pipeline runs in under 5 minutes."
            selected={mode === 'single'}
            onClick={() => setMode('single')}
          />
          <Choice
            title="Bulk paste"
            desc="Paste a list of LinkedIn URLs (one per line). Pipeline runs sequentially with per-row progress."
            selected={mode === 'bulk'}
            onClick={() => setMode('bulk')}
          />
          <Choice
            title="Batch from TAM account"
            desc="Pick an account, Apollo sources ICP-matching candidates, all gates run automatically. Requires Apollo API key in Settings."
            selected={mode === 'batch'}
            onClick={() => setMode('batch')}
          />
          <Footer>
            <button className="btn-ghost" onClick={() => setStep('motion')}>Back</button>
            <button className="btn-primary" onClick={() => setStep('source')}>Continue</button>
          </Footer>
        </Question>
      )}

      {step === 'source' && mode === 'single' && (
        <Question title="Who's the prospect?" subtitle="Paste a LinkedIn profile or Sales Nav lead URL.">
          <input
            className="input"
            placeholder="https://www.linkedin.com/in/firstname-lastname-12345/"
            value={profileUrl}
            onChange={(e) => setProfileUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && /linkedin\.com\/(in|sales)/.test(profileUrl)) runPipeline();
            }}
          />
          {pipelineErr && (
            <div className="mt-3 p-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-100">
              <div className="font-medium">Pipeline error</div>
              <div className="text-red-200/80 mt-1">{pipelineErr}</div>
              <div className="text-xs text-red-200/60 mt-2">
                If you see "research failed" with auth-related text, your LinkedIn session may have expired. Reopen Settings → LinkedIn login.
              </div>
            </div>
          )}
          <p className="text-xs text-ink-200/50 mt-2">
            Either a public profile URL or a Sales Nav lead URL works. The agent normalizes to /in/&lt;slug&gt;/.
          </p>
          <Footer>
            <button className="btn-ghost" onClick={() => setStep('mode')}>Back</button>
            <button
              className="btn-primary"
              disabled={!/linkedin\.com\/(in|sales)/.test(profileUrl)}
              onClick={runPipeline}
            >
              Run pipeline
            </button>
          </Footer>
        </Question>
      )}

      {step === 'source' && mode === 'batch' && (
        <Question title="Pick a TAM account" subtitle="Apollo sources ICP candidates at this org; pre-screens against DNC + prior contacts; you pick which to enroll.">
          <input
            className="input"
            placeholder="Filter accounts (Factor / G2 / TAM)…"
            value={accountQuery}
            onChange={(e) => setAccountQuery(e.target.value)}
          />
          <div className="card mt-3 max-h-64 overflow-y-auto">
            {accounts
              .filter((a) => !accountQuery.trim() || a.name.toLowerCase().includes(accountQuery.toLowerCase()))
              .slice(0, 50)
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => setSelectedAccountId(a.id)}
                  className={`w-full text-left px-3 py-2 border-b border-white/5 last:border-0 transition-colors ${
                    selectedAccountId === a.id ? 'bg-accent/10' : 'hover:bg-white/5'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2 text-sm">
                    <span className="font-medium truncate">{a.name}</span>
                    <span className={`pill text-[10px] ${
                      a.tier === 'Factor' ? 'bg-orange-500/20 text-orange-200' :
                      a.tier === 'G2' ? 'bg-purple-500/20 text-purple-200' :
                      'bg-blue-500/20 text-blue-200'
                    }`}>{a.tier}</span>
                  </div>
                  <div className="text-xs text-ink-200/50">{a.prospect_count} prospects researched</div>
                </button>
              ))}
          </div>

          {selectedAccountId && (
            <div className="mt-3 flex items-center gap-2">
              <button className="btn-primary" onClick={sourceCandidates} disabled={autoSourcing}>
                {autoSourcing ? 'Sourcing from Apollo…' : 'Source candidates'}
              </button>
              {autoCandidates.length > 0 && (
                <span className="text-xs text-ink-200/60">
                  {autoCandidates.filter((c) => c.preScreen.pass && c.linkedinUrl).length} pre-screen clean of {autoCandidates.length}
                </span>
              )}
            </div>
          )}

          {autoError && (
            <div className="mt-3 p-3 rounded-md border border-yellow-500/30 bg-yellow-500/10 text-sm text-yellow-100">
              {autoError}
            </div>
          )}

          {autoCandidates.length > 0 && (
            <div className="mt-4 card max-h-96 overflow-y-auto">
              {autoCandidates.map((c) => {
                const selected = autoSelected.has(c.apolloId);
                const blocked = !c.preScreen.pass || !c.linkedinUrl;
                return (
                  <button
                    key={c.apolloId}
                    onClick={() => {
                      if (blocked) return;
                      setAutoSelected((prev) => {
                        const next = new Set(prev);
                        if (next.has(c.apolloId)) next.delete(c.apolloId);
                        else next.add(c.apolloId);
                        return next;
                      });
                    }}
                    disabled={blocked}
                    className={`w-full text-left px-4 py-3 border-b border-white/5 last:border-0 transition-colors ${
                      blocked ? 'opacity-40 cursor-not-allowed' :
                      selected ? 'bg-accent/10' : 'hover:bg-white/5'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{c.name}</div>
                        <div className="text-xs text-ink-200/60 truncate">{c.title ?? '—'}</div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {!c.linkedinUrl && <span className="pill text-[10px] bg-yellow-500/20 text-yellow-200">no LinkedIn URL</span>}
                        {!c.preScreen.pass && <span className="pill text-[10px] bg-red-500/20 text-red-200">pre-screen drop</span>}
                        {!blocked && (
                          <span className={`pill text-[10px] ${selected ? 'bg-emerald-500/30 text-emerald-100' : 'bg-white/10 text-ink-200/60'}`}>
                            {selected ? '✓ selected' : 'click to select'}
                          </span>
                        )}
                      </div>
                    </div>
                    {!c.preScreen.pass && c.preScreen.reasons.length > 0 && (
                      <div className="text-xs text-red-200/80 mt-1">{c.preScreen.reasons.join(' · ')}</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}

          <Footer>
            <button className="btn-ghost" onClick={() => setStep('mode')}>Back</button>
            <button
              className="btn-primary"
              disabled={autoSelected.size === 0}
              onClick={runBatch}
            >
              Run pipeline on {autoSelected.size} candidate{autoSelected.size === 1 ? '' : 's'}
            </button>
          </Footer>
        </Question>
      )}

      {step === 'source' && mode === 'bulk' && (
        <Question title="Paste LinkedIn URLs" subtitle="One per line. Each will run through the full pipeline sequentially.">
          <textarea
            className="input min-h-[200px] font-mono text-xs"
            placeholder={'https://www.linkedin.com/in/example-1/\nhttps://www.linkedin.com/in/example-2/\nhttps://www.linkedin.com/in/example-3/'}
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
          />
          {(() => {
            if (!bulkText.trim()) {
              return <p className="text-xs text-ink-200/60 mt-2">Paste lines above to see live URL parsing + de-dup preview.</p>;
            }
            const r = normalizeBulkUrls(bulkText);
            return (
              <div className="mt-2 text-xs space-y-1">
                <p className="text-ink-200/70">
                  <span className="text-emerald-200">{r.valid.length} valid</span>
                  {r.duplicatesRemoved > 0 && <> · <span className="text-yellow-200">{r.duplicatesRemoved} duplicate{r.duplicatesRemoved === 1 ? '' : 's'} removed</span></>}
                  {r.invalid.length > 0 && <> · <span className="text-red-200">{r.invalid.length} invalid</span></>}
                </p>
                {r.invalid.length > 0 && (
                  <details className="text-ink-200/50">
                    <summary className="cursor-pointer text-ink-200/70 select-none">Show invalid lines</summary>
                    <ul className="mt-1 space-y-0.5 font-mono text-[10px]">
                      {r.invalid.slice(0, 10).map((i, idx) => (
                        <li key={idx} className="text-red-200/70">
                          {i.sourceLine.slice(0, 70)} — {i.reason}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
                <p className="text-ink-200/50">INC-028 daily cap is 10 sends/day for connection requests; bulk drafting is unlimited (you decide which to approve).</p>
              </div>
            );
          })()}
          <Footer>
            <button className="btn-ghost" onClick={() => setStep('mode')}>Back</button>
            <button
              className="btn-primary"
              disabled={!bulkText.trim()}
              onClick={runBulk}
            >
              Run pipeline on all
            </button>
          </Footer>
        </Question>
      )}

      {step === 'running' && bulkRows.length === 0 && (
        <div className="space-y-4">
          <PipelineProgress events={events} />
          <details className="card p-4 text-xs text-ink-200/60">
            <summary className="cursor-pointer text-ink-200/80 select-none">Raw event log ({events.length})</summary>
            <ol className="mt-3 space-y-1 font-mono">
              {events.map((e, i) => (
                <li key={i} className="flex gap-2">
                  <span className="text-ink-200/40">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span>
                  <span className="text-ink-200/60">{e.phase ?? e.kind}</span>
                  <span className="text-ink-200/80 truncate">{e.message ?? ''}</span>
                </li>
              ))}
            </ol>
          </details>
        </div>
      )}

      {step === 'running' && bulkRows.length > 0 && (
        <BulkProgress rows={bulkRows} events={events} onDone={() => setStep('motion')} />
      )}

      {step === 'review' && result && (
        <Review
          result={result}
          detail={detail}
          setDetail={setDetail}
          onApprove={() => approve(false)}
          onSimulate={simulate}
          onReset={reset}
          sending={sending}
          sendErr={sendErr}
        />
      )}

      {step === 'sent' && (
        <div className="card p-6">
          <h2 className="text-base font-medium">Done.</h2>
          <p className="text-sm text-ink-200/60 mt-1">
            Logged to outreach. Reply-sync will pick up an accept or response on the next reconciliation pass.
          </p>
          <Footer>
            <button className="btn-ghost" onClick={onDone}>View activity</button>
            <button className="btn-primary" onClick={reset}>Send another</button>
          </Footer>
        </div>
      )}
    </div>
  );
}

function Stepper({ step }: { step: Step }) {
  const steps: Array<{ id: Step; label: string }> = [
    { id: 'motion', label: 'Motion' },
    { id: 'mode', label: 'Mode' },
    { id: 'source', label: 'Source' },
    { id: 'running', label: 'Pipeline' },
    { id: 'review', label: 'Review' },
    { id: 'sent', label: 'Sent' }
  ];
  const idx = steps.findIndex((s) => s.id === step);
  return (
    <div className="mb-8 flex items-center gap-2 text-xs text-ink-200/60">
      {steps.map((s, i) => (
        <span key={s.id} className="flex items-center gap-2">
          <span className={i <= idx ? 'text-ink-100 font-medium' : ''}>{s.label}</span>
          {i < steps.length - 1 && <span className="text-ink-200/30">→</span>}
        </span>
      ))}
    </div>
  );
}

function Question({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div>
      <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
      {subtitle && <p className="text-ink-200/60 text-sm mt-1">{subtitle}</p>}
      <div className="mt-6 space-y-3">{children}</div>
    </div>
  );
}

function Choice({ title, desc, selected, onClick, disabled, badge }: { title: string; desc: string; selected?: boolean; onClick: () => void; disabled?: boolean; badge?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`w-full text-left card p-4 transition-colors ${
        selected ? 'border-accent bg-accent/10' : 'hover:bg-white/5'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium text-sm">{title}</div>
        {badge && <span className="pill bg-white/10 text-ink-200/70">{badge}</span>}
      </div>
      <div className="text-xs text-ink-200/60 mt-1">{desc}</div>
    </button>
  );
}

function Footer({ children }: { children: React.ReactNode }) {
  return <div className="mt-8 flex items-center justify-end gap-2">{children}</div>;
}

function Review({
  result,
  detail,
  setDetail,
  onApprove,
  onSimulate,
  onReset,
  sending,
  sendErr
}: {
  result: OrchestratorResult;
  detail: OutreachDetail | null;
  setDetail: (d: OutreachDetail | null) => void;
  onApprove: () => void;
  onSimulate: () => void;
  onReset: () => void;
  sending: boolean;
  sendErr: string | null;
}) {
  const conf = detail?.confidence_notes ?? result.draft?.confidence ?? null;
  const passed = (detail?.status === 'draft' || result.success) && conf?.pass;

  // Local edit state
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState(detail?.draft_body ?? result.draft?.body ?? '');
  const [subject, setSubject] = useState(detail?.draft_subject ?? result.draft?.subject ?? '');
  const [savingEdit, setSavingEdit] = useState(false);
  const [rescoring, setRescoring] = useState(false);

  // Re-sync local state when detail row changes.
  useEffect(() => {
    if (!detail) return;
    setBody(detail.draft_body);
    setSubject(detail.draft_subject ?? '');
  }, [detail]);

  async function saveEdit() {
    if (!result.outreach_id) return;
    setSavingEdit(true);
    const r = await window.api.updateDraft(result.outreach_id, { body, subject: subject || undefined });
    setSavingEdit(false);
    if (r.ok) {
      pushToast('success', `Saved · D1 ${r.confidence?.d1_formula}/10 · overall ${r.confidence?.overall.toFixed(1)}/10`);
      const fresh = await window.api.getOutreachDetail(result.outreach_id);
      setDetail(fresh);
      setEditing(false);
    } else {
      pushToast('error', 'Could not save edit');
    }
  }

  async function rescore() {
    if (!result.outreach_id) return;
    setRescoring(true);
    const r = await window.api.rescoreLLM(result.outreach_id);
    setRescoring(false);
    if (r.ok) {
      pushToast('success', `Re-scored · D2 ${r.confidence?.d2_evidence}/10 · D3 ${r.confidence?.d3_specificity}/10`);
      const fresh = await window.api.getOutreachDetail(result.outreach_id);
      setDetail(fresh);
    } else {
      pushToast('error', `Re-score failed: ${r.error ?? 'unknown'}`);
    }
  }

  async function copyDraft() {
    const txt = subject ? `Subject: ${subject}\n\n${body}` : body;
    try {
      await navigator.clipboard.writeText(txt);
      pushToast('success', 'Copied to clipboard');
    } catch {
      pushToast('error', 'Clipboard write failed');
    }
  }

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Review draft</h2>
          {conf && (
            <div className={`pill ${passed ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
              Confidence {conf.overall.toFixed(1)} / 10 {passed ? '✓' : '✗'}
            </div>
          )}
        </div>

        {result.drop_reason && !editing && (
          <div className="mt-4 p-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-100">
            <div className="font-medium">Pipeline dropped this prospect</div>
            <div className="text-red-200/80 mt-1">{result.drop_reason}</div>
            <div className="text-xs text-red-200/70 mt-2">You can edit the draft below to bring D1 to 10/10 and pass.</div>
          </div>
        )}

        {result.draft && (
          <>
            {(subject || result.draft.subject) && (
              <div className="mt-4">
                <div className="label">Subject</div>
                {editing ? (
                  <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
                ) : (
                  <pre className="card p-3 text-sm font-sans text-ink-100">{subject || result.draft.subject}</pre>
                )}
              </div>
            )}
            <div className="mt-4">
              <div className="label">{result.draft.subject || subject ? 'InMail body' : 'Connection request body'}</div>
              {editing ? (
                <textarea
                  className="input min-h-[160px] font-sans"
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                />
              ) : (
                <pre className="card p-3 text-sm whitespace-pre-wrap font-sans text-ink-100">{body || result.draft.body}</pre>
              )}
              <div className="text-xs text-ink-200/50 mt-1">
                {(body || result.draft.body).length} chars · dept = "{result.draft.dept}" · hook = "{result.draft.hook}"
              </div>
            </div>

            {conf && (
              <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
                <ScoreCell label="D1 formula" value={conf.d1_formula} />
                <ScoreCell label="D2 evidence" value={conf.d2_evidence} />
                <ScoreCell label="D3 specificity" value={conf.d3_specificity} />
              </div>
            )}

            {conf && conf.fail_reasons.length > 0 && (
              <div className="mt-3 text-xs text-yellow-200/80">
                <div className="label">QA notes</div>
                <ul className="list-disc list-inside space-y-0.5">
                  {conf.fail_reasons.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </>
        )}

        {sendErr && (
          <div className="mt-3 p-3 rounded-md border border-red-500/30 bg-red-500/10 text-sm text-red-100">
            Send failed: {sendErr}
          </div>
        )}

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          {!editing ? (
            <>
              <button className="btn-ghost" onClick={onReset}>Discard</button>
              <button className="btn-ghost" onClick={copyDraft}>Copy</button>
              <button className="btn-ghost" onClick={() => setEditing(true)}>Edit</button>
              <button className="btn-ghost" onClick={rescore} disabled={rescoring}>
                {rescoring ? 'Re-scoring…' : 'Re-score (LLM)'}
              </button>
              <button className="btn-ghost" onClick={onSimulate} disabled={sending}>Simulate send</button>
              <button
                className="btn-primary"
                disabled={!passed || sending}
                onClick={onApprove}
                title={passed ? 'Send via Playwright with INC-022 readback' : 'QA gate must pass before send'}
              >
                {sending ? 'Sending…' : 'Approve & Send'}
              </button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit} disabled={savingEdit}>
                {savingEdit ? 'Saving…' : 'Save edits'}
              </button>
            </>
          )}
        </div>
      </div>

      {detail?.evidence && (
        <div className="card p-6">
          <h2 className="text-base font-medium">Evidence</h2>
          <p className="text-xs text-ink-200/50 mt-1">Live LinkedIn capture the draft anchors to. Edits to the draft hook should remain traceable to this evidence.</p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Live headline" value={detail.evidence.live_headline ?? '—'} mono />
            <Field label="Location" value={detail.evidence.live_location ?? '—'} />
            <Field label="Connection degree" value={detail.evidence.connection_degree ?? '—'} />
            <Field label="Activity" value={detail.evidence.activity_status ?? '—'} />
            <Field label="Connections" value={String(detail.evidence.connection_count ?? '—')} />
            <Field label="Followers" value={String(detail.evidence.follower_count ?? '—')} />
          </div>
          {detail.evidence.evidence_quote_for_hook && (
            <div className="mt-4">
              <div className="label">Evidence quote (hook anchor)</div>
              <pre className="card p-3 text-xs whitespace-pre-wrap font-mono text-ink-200/80">{detail.evidence.evidence_quote_for_hook}</pre>
            </div>
          )}
          {detail.evidence.activity_quotes.length > 0 && (
            <div className="mt-3">
              <div className="label">Recent activity captured</div>
              <ul className="list-disc list-inside space-y-1 text-xs text-ink-200/70">
                {detail.evidence.activity_quotes.map((q, i) => <li key={i}>{q}</li>)}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`text-ink-100 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
}

function BulkProgress({
  rows,
  events,
  onDone
}: {
  rows: BulkRow[];
  events: OrchestratorEvent[];
  onDone: () => void;
}) {
  const done = rows.every((r) => r.status === 'pass' || r.status === 'drop' || r.status === 'error');
  const passed = rows.filter((r) => r.status === 'pass').length;
  const dropped = rows.filter((r) => r.status === 'drop').length;
  const errored = rows.filter((r) => r.status === 'error').length;
  const running = rows.filter((r) => r.status === 'running').length;
  const pending = rows.filter((r) => r.status === 'pending').length;

  return (
    <div className="space-y-4">
      <div className="card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Bulk pipeline</h2>
          <div className="text-xs text-ink-200/60">
            {done ? 'Complete.' : 'In progress…'}{' '}
            <span className="text-emerald-200">{passed} pass</span> · <span className="text-red-200">{dropped} drop</span>
            {errored > 0 && <> · <span className="text-red-100">{errored} error</span></>}
            {running > 0 && <> · {running} running</>}
            {pending > 0 && <> · {pending} pending</>}
          </div>
        </div>

        <div className="mt-4 divide-y divide-white/5">
          {rows.map((r, i) => (
            <BulkRowView key={i} row={r} index={i} />
          ))}
        </div>

        {done && (
          <div className="mt-6 flex items-center justify-between">
            <p className="text-sm text-ink-200/60">
              Review individual drafts in <span className="font-medium text-ink-100">Activity</span>. Drops are logged with reasons.
            </p>
            <button className="btn-primary" onClick={onDone}>Done</button>
          </div>
        )}
      </div>

      {!done && events.length > 0 && (
        <details className="card p-4 text-xs text-ink-200/60">
          <summary className="cursor-pointer text-ink-200/80 select-none">Current row event log</summary>
          <ol className="mt-3 space-y-1 font-mono">
            {events.slice(-15).map((e, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-ink-200/40">{new Date(e.ts).toLocaleTimeString([], { hour12: false })}</span>
                <span className="text-ink-200/60">{e.phase ?? e.kind}</span>
                <span className="text-ink-200/80 truncate">{e.message ?? ''}</span>
              </li>
            ))}
          </ol>
        </details>
      )}
    </div>
  );
}

function BulkRowView({ row, index }: { row: BulkRow; index: number }) {
  const slug = (() => {
    const m = row.url.match(/\/in\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : row.url;
  })();
  return (
    <div className="flex items-start gap-3 py-3 text-sm">
      <div className="shrink-0 w-7 h-7 mt-0.5 flex items-center justify-center">
        <BulkStatusIcon status={row.status} />
      </div>
      <div className="text-xs text-ink-200/40 font-mono mt-1.5 w-6 text-right">{index + 1}.</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium truncate">{slug}</div>
        <div className="text-xs text-ink-200/50 truncate">{row.url}</div>
        {row.reason && (
          <div className={`text-xs mt-1 ${row.status === 'pass' ? 'text-emerald-200/80' : row.status === 'drop' ? 'text-red-200/80' : 'text-yellow-200/80'}`}>
            {row.reason}
          </div>
        )}
      </div>
      <div className="text-xs text-ink-200/60 whitespace-nowrap">
        {row.confidence !== undefined && <span className="font-mono">{row.confidence.toFixed(1)}/10</span>}
      </div>
    </div>
  );
}

function BulkStatusIcon({ status }: { status: BulkRow['status'] }) {
  switch (status) {
    case 'pending':
      return <div className="w-5 h-5 rounded-full border border-ink-200/20 bg-ink-900/40" />;
    case 'running':
      return (
        <div className="w-5 h-5 rounded-full border-2 border-blue-400 flex items-center justify-center">
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
        </div>
      );
    case 'pass':
      return <div className="w-5 h-5 rounded-full bg-emerald-500/30 border border-emerald-400/50 flex items-center justify-center text-[10px] text-emerald-200">✓</div>;
    case 'drop':
      return <div className="w-5 h-5 rounded-full bg-red-500/30 border border-red-400/50 flex items-center justify-center text-[10px] text-red-200">✗</div>;
    case 'error':
      return <div className="w-5 h-5 rounded-full bg-red-500/40 border border-red-400/60 flex items-center justify-center text-[10px] text-red-100">⚠</div>;
  }
}

function ScoreCell({ label, value }: { label: string; value: number }) {
  const c = value >= 9 ? 'text-emerald-200' : value >= 7 ? 'text-yellow-200' : 'text-red-200';
  return (
    <div className="card p-3">
      <div className="text-ink-200/50">{label}</div>
      <div className={`text-base font-semibold mt-1 ${c}`}>{value.toFixed(1)} / 10</div>
    </div>
  );
}
