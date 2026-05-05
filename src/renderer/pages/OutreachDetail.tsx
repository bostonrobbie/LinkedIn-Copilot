import { useEffect, useState } from 'react';
import type { OutreachDetail } from '../../shared/types';
import { pushToast } from '../components/Toast';

interface GateLogRow {
  id: number;
  outreach_id: number | null;
  prospect_id: number | null;
  phase: string;
  decision: string;
  reason: string | null;
  ts: string;
}

export default function OutreachDetailView({
  outreachId,
  onClose
}: {
  outreachId: number;
  onClose: () => void;
}) {
  const [detail, setDetail] = useState<OutreachDetail | null>(null);
  const [gateLog, setGateLog] = useState<GateLogRow[]>([]);
  const [editing, setEditing] = useState(false);
  const [body, setBody] = useState('');
  const [subject, setSubject] = useState('');
  const [busy, setBusy] = useState(false);

  async function load() {
    const d = await window.api.getOutreachDetail(outreachId);
    setDetail(d);
    if (d) {
      setBody(d.draft_body);
      setSubject(d.draft_subject ?? '');
    }
    const g = await window.api.getGateLog(outreachId, 50);
    setGateLog(g);
  }

  useEffect(() => {
    void load();
  }, [outreachId]);

  if (!detail) {
    return (
      <div className="p-10">
        <div className="text-ink-200/40 text-sm">Loading…</div>
      </div>
    );
  }

  const conf = detail.confidence_notes;
  const passed = detail.status !== 'dropped' && conf?.pass;

  async function saveEdit() {
    setBusy(true);
    const r = await window.api.updateDraft(outreachId, { body, subject: subject || undefined });
    setBusy(false);
    if (r.ok) {
      pushToast('success', `Saved · D1 ${r.confidence?.d1_formula}/10`);
      await load();
      setEditing(false);
    } else {
      pushToast('error', 'save failed');
    }
  }

  async function rescore() {
    setBusy(true);
    const r = await window.api.rescoreLLM(outreachId);
    setBusy(false);
    if (r.ok) {
      pushToast('success', `Re-scored · overall ${r.confidence?.overall.toFixed(1)}/10`);
      await load();
    } else pushToast('error', `Re-score failed: ${r.error ?? 'unknown'}`);
  }

  async function approve() {
    setBusy(true);
    const r = await window.api.approveAndSend(outreachId);
    setBusy(false);
    if (r.ok) { pushToast('success', 'Sent.'); await load(); }
    else pushToast('error', `Send failed: ${r.error ?? 'unknown'}`);
  }

  async function simulate() {
    setBusy(true);
    const r = await window.api.simulateSend(outreachId);
    setBusy(false);
    if (r.ok) { pushToast('info', 'Simulated send'); await load(); }
    else pushToast('error', 'Simulate failed (status not draft)');
  }

  async function copyDraft() {
    const txt = subject ? `Subject: ${subject}\n\n${body}` : body;
    try { await navigator.clipboard.writeText(txt); pushToast('success', 'Copied'); }
    catch { pushToast('error', 'Clipboard write failed'); }
  }

  return (
    <div className="p-10 max-w-5xl">
      <div className="flex items-center gap-3 mb-2">
        <button className="btn-ghost" onClick={onClose}>← Back to Activity</button>
      </div>

      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{detail.prospect.full_name}</h1>
          <div className="text-ink-200/70 text-sm mt-1">
            {detail.prospect.title ?? '—'} {detail.prospect.company_name ? `at ${detail.prospect.company_name}` : ''}
          </div>
          <a
            href={detail.prospect.linkedin_url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-accent hover:underline mt-1 inline-block"
          >
            {detail.prospect.linkedin_url}
          </a>
        </div>
        <div className="flex flex-col items-end gap-2">
          <StatusPill status={detail.status} />
          {conf && (
            <div className={`pill ${passed ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'}`}>
              {conf.overall.toFixed(1)} / 10 {passed ? '✓' : '✗'}
            </div>
          )}
          {detail.tier && (
            <div className={`pill ${
              detail.tier === 'A++' ? 'bg-purple-500/20 text-purple-200' :
              detail.tier === 'A+' ? 'bg-blue-500/20 text-blue-200' :
              'bg-white/10 text-ink-200/70'
            }`}>
              Hook tier {detail.tier}
            </div>
          )}
          <div className="text-xs text-ink-200/50">
            {detail.motion === 'connection_request' ? 'Connection request' : 'Sales Nav InMail'}
          </div>
        </div>
      </div>

      {detail.status === 'replied' && detail.reply_body && (
        <ReplyCard
          outreachId={detail.id}
          reply={detail.reply_body}
          classification={detail.reply_classification}
          onChange={load}
        />
      )}

      <section className="card p-6 mt-6">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-medium">Draft</h2>
          <div className="flex items-center gap-2">
            <button className="btn-ghost text-xs" onClick={copyDraft}>Copy</button>
            {!editing && <button className="btn-ghost text-xs" onClick={() => setEditing(true)}>Edit</button>}
            <button className="btn-ghost text-xs" onClick={rescore} disabled={busy}>Re-score (LLM)</button>
          </div>
        </div>

        {detail.draft_subject !== null && (
          <div className="mt-4">
            <div className="label">Subject</div>
            {editing ? (
              <input className="input" value={subject} onChange={(e) => setSubject(e.target.value)} />
            ) : (
              <pre className="card p-3 text-sm font-sans">{subject || detail.draft_subject}</pre>
            )}
          </div>
        )}

        <div className="mt-4">
          <div className="label">{detail.draft_subject !== null ? 'Body' : 'Connection request body'}</div>
          {editing ? (
            <textarea
              className="input min-h-[180px] font-sans"
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          ) : (
            <pre className="card p-3 text-sm whitespace-pre-wrap font-sans">{body}</pre>
          )}
          <div className="text-xs text-ink-200/50 mt-1">
            {body.length} chars · dept = "{detail.dept}" · hook = "{detail.hook}"
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

        <div className="mt-6 flex items-center justify-end gap-2">
          {editing ? (
            <>
              <button className="btn-ghost" onClick={() => { setEditing(false); setBody(detail.draft_body); setSubject(detail.draft_subject ?? ''); }}>Cancel</button>
              <button className="btn-primary" onClick={saveEdit} disabled={busy}>Save edits</button>
            </>
          ) : detail.status === 'draft' ? (
            <>
              <button className="btn-ghost" onClick={simulate} disabled={busy}>Simulate send</button>
              <button className="btn-primary" onClick={approve} disabled={!passed || busy}>
                {busy ? '…' : 'Approve & Send'}
              </button>
            </>
          ) : detail.status === 'failed' ? (
            <button className="btn-primary" onClick={async () => {
              if (!window.confirm('Re-queue this outreach for another send attempt? It will go through the send queue worker with full backoff.')) return;
              setBusy(true);
              const r = await window.api.requeueOutreach(detail.id);
              setBusy(false);
              if (r.ok) { pushToast('success', `Re-queued (queue id ${r.queueId ?? '?'})`); await load(); }
              else pushToast('error', `Re-queue failed: ${r.error ?? 'unknown'}`);
            }} disabled={busy}>
              {busy ? '…' : 'Re-queue send'}
            </button>
          ) : null}
        </div>
      </section>

      {(detail.prospect.apollo_company || detail.prospect.apollo_title || (detail.prospect.apollo_employment && detail.prospect.apollo_employment.length > 0)) && (
        <ApolloEnrichmentPanel
          apolloCompany={detail.prospect.apollo_company}
          apolloTitle={detail.prospect.apollo_title}
          apolloEmployment={detail.prospect.apollo_employment}
          linkedinCompany={detail.prospect.company_name}
          linkedinTitle={detail.prospect.title}
        />
      )}

      {detail.evidence && (
        <section className="card p-6 mt-4">
          <h2 className="text-base font-medium">Evidence</h2>
          <p className="text-xs text-ink-200/50 mt-1">
            Captured {new Date(detail.evidence.captured_at).toLocaleString()} via {detail.evidence.captured_via}.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            <Field label="Live headline" value={detail.evidence.live_headline ?? '—'} mono />
            <Field label="Location" value={detail.evidence.live_location ?? '—'} />
            <Field label="Connection degree" value={detail.evidence.connection_degree ?? '—'} />
            <Field label="Activity status" value={detail.evidence.activity_status ?? '—'} />
            <Field label="Connections" value={String(detail.evidence.connection_count ?? '—')} />
            <Field label="Followers" value={String(detail.evidence.follower_count ?? '—')} />
          </div>
          {detail.evidence.evidence_quote_for_hook && (
            <div className="mt-4">
              <div className="label">Evidence quote (hook anchor)</div>
              <pre className="card p-3 text-xs whitespace-pre-wrap font-mono text-ink-200/80">
                {detail.evidence.evidence_quote_for_hook}
              </pre>
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
        </section>
      )}

      <section className="card p-6 mt-4">
        <h2 className="text-base font-medium">Gate decisions</h2>
        <p className="text-xs text-ink-200/50 mt-1">
          Every gate the agent ran for this prospect. Lifted from the gate_log table.
        </p>
        <table className="w-full text-sm mt-4">
          <thead>
            <tr className="text-left text-xs uppercase tracking-wide text-ink-200/50 border-b border-white/5">
              <th className="py-2">When</th>
              <th className="py-2">Phase</th>
              <th className="py-2">Decision</th>
              <th className="py-2">Reason</th>
            </tr>
          </thead>
          <tbody>
            {gateLog.length === 0 && (
              <tr><td colSpan={4} className="py-3 text-ink-200/40">No gate decisions logged.</td></tr>
            )}
            {gateLog.map((g) => (
              <tr key={g.id} className="border-b border-white/5 last:border-0">
                <td className="py-2 text-xs text-ink-200/50 font-mono">{g.ts}</td>
                <td className="py-2"><span className="pill bg-white/10 text-ink-200/80">Phase {g.phase}</span></td>
                <td className="py-2"><DecisionPill d={g.decision} /></td>
                <td className="py-2 text-ink-200/80">{g.reason ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

// Format dates from Apollo (which arrive as "2018-03" or "2018-03-15" or "2018").
const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
function formatApolloDate(input: string | undefined | null): string {
  if (!input) return '?';
  const m = input.match(/^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?/);
  if (!m) return input;
  const year = m[1];
  const monthIdx = m[2] ? Number(m[2]) - 1 : -1;
  if (monthIdx >= 0 && monthIdx < 12) return `${MONTH_NAMES[monthIdx]} ${year}`;
  return year;
}

function ApolloEnrichmentPanel({
  apolloCompany,
  apolloTitle,
  apolloEmployment,
  linkedinCompany,
  linkedinTitle
}: {
  apolloCompany: string | null;
  apolloTitle: string | null;
  apolloEmployment: Array<{ organization_name?: string; title?: string; current?: boolean; start_date?: string; end_date?: string }> | null;
  linkedinCompany: string | null;
  linkedinTitle: string | null;
}) {
  const companyMismatch = apolloCompany && linkedinCompany &&
    apolloCompany.trim().toLowerCase() !== linkedinCompany.trim().toLowerCase() &&
    !apolloCompany.toLowerCase().includes(linkedinCompany.toLowerCase()) &&
    !linkedinCompany.toLowerCase().includes(apolloCompany.toLowerCase());

  const titleMismatch = apolloTitle && linkedinTitle &&
    apolloTitle.trim().toLowerCase() !== linkedinTitle.trim().toLowerCase();

  const sortedEmployment = apolloEmployment
    ? [...apolloEmployment].sort((a, b) => {
        if (a.current && !b.current) return -1;
        if (!a.current && b.current) return 1;
        const aDate = a.start_date ?? '';
        const bDate = b.start_date ?? '';
        return bDate.localeCompare(aDate);
      })
    : null;

  return (
    <section className="card p-6 mt-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Apollo enrichment</h2>
        <span className="text-[10px] text-ink-200/40 font-mono">from /v1/people/match</span>
      </div>
      <p className="text-xs text-ink-200/60 mt-1">
        What Apollo knows about this prospect. Compare with the live LinkedIn capture above — discrepancies are flagged.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
        <div>
          <div className="label">Apollo employer</div>
          <div className="text-ink-100">{apolloCompany ?? '—'}</div>
          {companyMismatch && (
            <div className="text-xs text-yellow-200/80 mt-0.5">
              ⚠ differs from LinkedIn ("{linkedinCompany}") — Phase 1.5b drops on this
            </div>
          )}
        </div>
        <div>
          <div className="label">Apollo title</div>
          <div className="text-ink-100">{apolloTitle ?? '—'}</div>
          {titleMismatch && (
            <div className="text-xs text-yellow-200/80 mt-0.5">
              ⚠ differs from LinkedIn ("{linkedinTitle}") — title-discrepancy pattern
            </div>
          )}
        </div>
      </div>

      {sortedEmployment && sortedEmployment.length > 0 && (
        <div className="mt-5">
          <div className="label">Career history</div>
          <div className="card mt-2 divide-y divide-white/5">
            {sortedEmployment.map((e, i) => (
              <div key={i} className="px-3 py-2 text-sm flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{e.title ?? '—'}</div>
                  <div className="text-xs text-ink-200/60 truncate">{e.organization_name ?? '—'}</div>
                </div>
                <div className="text-xs text-ink-200/50 whitespace-nowrap">
                  {formatApolloDate(e.start_date)} → {e.current ? 'present' : formatApolloDate(e.end_date)}
                  {e.current && <span className="ml-1 pill text-[10px] bg-emerald-500/20 text-emerald-200">current</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function ReplyCard({
  outreachId,
  reply,
  classification,
  onChange
}: {
  outreachId: number;
  reply: string;
  classification: 'P0_warm' | 'P1_engaged' | 'P2_decline' | 'P3_auto_reply' | 'P4_hostile' | null;
  onChange: () => Promise<void>;
}) {
  const labels: Record<string, { label: string; color: string; suggestion: string }> = {
    P0_warm: { label: 'P0 — warm / meeting ask', color: 'bg-emerald-500/20 text-emerald-100 border-emerald-500/40', suggestion: 'Send the calendar link, get on a call. This is hot.' },
    P1_engaged: { label: 'P1 — engaged, no meeting yet', color: 'bg-blue-500/20 text-blue-100 border-blue-500/40', suggestion: 'Reply within 4 hours with a soft CTA — share a one-pager, ask a discovery question.' },
    P2_decline: { label: 'P2 — polite decline', color: 'bg-yellow-500/20 text-yellow-100 border-yellow-500/40', suggestion: 'Acknowledge gracefully. Set a 60-day re-engage flag.' },
    P3_auto_reply: { label: 'P3 — auto-reply / OOO', color: 'bg-white/10 text-ink-200/80 border-white/20', suggestion: 'Wait — they didn\'t actually engage. Mark for re-touch when they\'re back.' },
    P4_hostile: { label: 'P4 — hostile / unsubscribe', color: 'bg-red-500/20 text-red-100 border-red-500/40', suggestion: 'Auto-DNC has been added. Do NOT respond. Future re-attempts will be blocked.' }
  };
  const meta = classification ? labels[classification] : null;

  const [reclassing, setReclassing] = useState(false);
  const [autoDncRows, setAutoDncRows] = useState<Array<{ id: number; display_name: string; reason: string | null; auto_added_reason_kind: string | null }>>([]);
  const [overrideHistory, setOverrideHistory] = useState<Array<{ id: number; prior_value: string | null; new_value: string | null; reason: string | null; source: string; ts: string }>>([]);

  useEffect(() => {
    void window.api.listAutoDncForOutreach(outreachId).then((r) => setAutoDncRows(r));
    void window.api.listClassificationOverrides(outreachId).then((r) => setOverrideHistory(r));
  }, [outreachId, classification]);

  async function reclassify() {
    setReclassing(true);
    const r = await window.api.reclassifyReply(outreachId);
    setReclassing(false);
    if (r) pushToast('success', `Re-classified as ${r.classification} (${r.source})`);
    else pushToast('error', 'Re-classify failed');
    await onChange();
  }

  async function setOverride(value: 'P0_warm' | 'P1_engaged' | 'P2_decline' | 'P3_auto_reply' | 'P4_hostile') {
    const reason = window.prompt(`Override classification to ${value}. Optional: why? (saved to audit trail)`, '');
    // Cancel returns null; empty string is OK (no reason given).
    if (reason === null) return;
    await window.api.setReplyClassification(outreachId, value, reason || undefined);
    pushToast('info', `Classification overridden to ${value}`);
    await onChange();
  }

  async function reverseDnc() {
    if (!window.confirm('Remove the auto-DNC entry for this prospect? They will be eligible for future outreach again.')) return;
    const r = await window.api.reverseAutoDnc(outreachId);
    if (r.ok) pushToast('success', `Removed ${r.removed} auto-DNC entry`);
    else pushToast('info', 'No auto-DNC found to reverse');
    await onChange();
    setAutoDncRows([]);
  }

  return (
    <section className={`card p-6 mt-6 border-l-4 ${meta ? meta.color : 'border-white/10'}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-base font-medium">Reply received</h2>
        {meta && <span className={`pill text-xs ${meta.color}`}>{meta.label}</span>}
      </div>
      <pre className="mt-4 card p-3 text-sm whitespace-pre-wrap font-sans bg-ink-900/40">{reply}</pre>
      {meta && (
        <div className="mt-3 text-xs text-ink-200/70">
          <strong className="text-ink-100">Suggested response:</strong> {meta.suggestion}
        </div>
      )}
      {!meta && (
        <div className="mt-3 text-xs text-ink-200/50">Classification pending — sync run will categorize on the next pass.</div>
      )}

      <div className="mt-5 pt-4 border-t border-white/5 flex items-center justify-between gap-3 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-ink-200/40 mr-2">Override:</span>
          {(['P0_warm', 'P1_engaged', 'P2_decline', 'P3_auto_reply', 'P4_hostile'] as const).map((c) => (
            <button
              key={c}
              onClick={() => setOverride(c)}
              className={`pill text-[10px] px-1.5 py-0.5 transition-colors ${
                classification === c
                  ? 'bg-accent/30 text-white'
                  : 'bg-white/5 text-ink-200/70 hover:bg-white/10'
              }`}
            >
              {c.replace('P', '').replace('_', ' ')}
            </button>
          ))}
        </div>
        <button className="btn-ghost text-xs" onClick={reclassify} disabled={reclassing}>
          {reclassing ? 'Re-classifying…' : 'Re-run classifier'}
        </button>
      </div>

      {autoDncRows.length > 0 && (
        <div className="mt-4 p-3 rounded-md border border-red-500/30 bg-red-500/5 text-xs">
          <div className="font-medium text-red-100">Auto-DNC active for this outreach</div>
          <ul className="mt-1 text-red-200/80 list-disc list-inside">
            {autoDncRows.map((d) => (
              <li key={d.id}>{d.display_name} — {d.auto_added_reason_kind} — {d.reason}</li>
            ))}
          </ul>
          <button className="btn-ghost text-xs mt-2 text-red-100" onClick={reverseDnc}>Reverse auto-DNC</button>
        </div>
      )}

      {overrideHistory.length > 0 && (
        <details className="mt-4 text-xs">
          <summary className="cursor-pointer text-ink-200/70 select-none">
            Override history ({overrideHistory.length})
          </summary>
          <div className="mt-2 card divide-y divide-white/5">
            {overrideHistory.map((h) => (
              <div key={h.id} className="px-3 py-2">
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="text-ink-200/40">{h.ts}</span>
                  <span className="pill text-[10px] bg-white/10 text-ink-200/70">{h.source}</span>
                  <span className="text-ink-200/80">
                    {h.prior_value ?? 'unset'} → <span className="text-ink-100">{h.new_value ?? 'unset'}</span>
                  </span>
                </div>
                {h.reason && (
                  <div className="mt-0.5 text-ink-200/70">"{h.reason}"</div>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls: Record<string, string> = {
    draft: 'bg-white/10 text-ink-200/70',
    queued: 'bg-blue-500/20 text-blue-200',
    sent: 'bg-emerald-500/20 text-emerald-200',
    accepted: 'bg-emerald-500/30 text-emerald-100',
    replied: 'bg-purple-500/20 text-purple-200',
    declined: 'bg-yellow-500/20 text-yellow-200',
    failed: 'bg-red-500/20 text-red-200',
    dropped: 'bg-red-500/10 text-red-200/70'
  };
  return <span className={`pill ${cls[status] ?? 'bg-white/10'}`}>{status}</span>;
}

function DecisionPill({ d }: { d: string }) {
  const cls = d === 'pass' ? 'bg-emerald-500/20 text-emerald-200'
            : d === 'drop' ? 'bg-red-500/20 text-red-200'
            : 'bg-yellow-500/20 text-yellow-200';
  return <span className={`pill ${cls}`}>{d}</span>;
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className={`text-ink-100 ${mono ? 'font-mono text-xs' : ''}`}>{value}</div>
    </div>
  );
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
