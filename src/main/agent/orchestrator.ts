// Single-prospect orchestrator. Runs phases 0.5 -> 0.6 -> 1.5 -> 0.7 -> 0.7.5 -> 3 ->
// research -> drafting -> 7.5 (with one remediation pass on sub-9 confidence).
// Returns OrchestratorResult; events stream via callback.

import log from 'electron-log';
import { getDb } from '../db/client';
import {
  apolloDedupCheck,
  degreeCheck,
  deliverabilityCheck,
  dncCheck,
  priorContactCheck,
  tamScopeCheck,
  wrongCompanyCheck
} from './gates';
import { researchProspect, setHookQuote } from './research';
import { buildDraft } from './drafting';
import { buildInMail, scoreInMailDraft, INMAIL_HARD_CONSTRAINTS } from './inmail';
import { scoreDraft } from './qa';
import { scoreD2D3, isAnthropicAvailable, setLlmStatusCallback } from './llm';
import { analyzeCareerArc, shouldDropOnCareerArc } from './careerArc';
import { insightsFromJson } from './apolloEmployment';
import { getLinkedInState, setLinkedInState } from '../runtime-state';
import type {
  GateDecision,
  OrchestratorEvent,
  OrchestratorRequest,
  OrchestratorResult
} from '@shared/types';

type Emit = (e: OrchestratorEvent) => void;

function now(): string {
  return new Date().toISOString();
}

function logGate(outreachId: number | null, prospectId: number | null, d: GateDecision): void {
  getDb()
    .prepare(
      `INSERT INTO gate_log (outreach_id, prospect_id, phase, decision, reason, meta)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
    .run(outreachId, prospectId, d.phase, d.decision, d.reason ?? null, d.meta ? JSON.stringify(d.meta) : null);
}

function emitGate(emit: Emit, d: GateDecision): void {
  emit({ kind: 'gate_decision', phase: d.phase, message: d.reason, payload: d, ts: now() });
}

// Polls runtime LinkedIn state until logged-in or timeout. Renderer is
// expected to trigger the login flow when it sees an `auth_required` event.
async function waitForLogin(timeoutSec: number): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutSec * 1000) {
    if (getLinkedInState().state === 'logged-in') return true;
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export async function runSingle(
  req: OrchestratorRequest,
  emit: Emit
): Promise<OrchestratorResult> {
  const events: OrchestratorEvent[] = [];
  const proxyEmit: Emit = (e) => {
    events.push(e);
    try { emit(e); } catch (err) { log.warn('emit failed', err); }
  };

  // Surface LLM retries (429 / 5xx / network) into the event stream.
  setLlmStatusCallback((msg) => proxyEmit({ kind: 'log', message: msg, ts: now() }));

  const userId = req.user_id;
  const url = req.source.kind === 'linkedin_url' || req.source.kind === 'sales_nav_url' ? req.source.url : '';

  proxyEmit({
    kind: 'log',
    message: isAnthropicAvailable()
      ? 'Anthropic API key detected — using LLM for hook generation and D2/D3 scoring.'
      : 'No Anthropic API key — running with heuristic fallbacks. Add a key in Settings to upgrade.',
    ts: now()
  });

  proxyEmit({ kind: 'phase_started', phase: 'research', message: 'capturing LinkedIn profile', ts: now() });
  let research;
  // Auto-recover from session expiry: try research, on auth-related failure
  // emit `auth_required` (renderer prompts re-login), wait up to 3 minutes for
  // setLinkedInState('logged-in'), then retry once.
  const isAuthError = (msg: string) => /redirected to login|session expired|not signed in|auth\b|401|\/login\b|\/authwall\b/i.test(msg);
  try {
    research = await researchProspect(userId, url);
    setLinkedInState('logged-in');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (isAuthError(msg)) {
      setLinkedInState('logged-out');
      proxyEmit({
        kind: 'auth_required',
        message: 'LinkedIn session expired — opening re-login window. Pipeline will resume after you sign back in.',
        ts: now()
      });
      // Wait up to 3 minutes for the session to come back. The renderer triggers
      // the login flow via the `auth_required` event handler.
      const ok = await waitForLogin(180);
      if (!ok) {
        proxyEmit({ kind: 'error', message: 'session re-login timed out', ts: now() });
        return { success: false, drop_reason: 'auth_required_timeout', events };
      }
      proxyEmit({ kind: 'log', message: 'Session restored. Resuming pipeline.', ts: now() });
      try {
        research = await researchProspect(userId, url);
        setLinkedInState('logged-in');
      } catch (err2) {
        const msg2 = err2 instanceof Error ? err2.message : String(err2);
        setLinkedInState('error');
        proxyEmit({ kind: 'error', message: 'research failed after re-login: ' + msg2, ts: now() });
        return { success: false, drop_reason: 'research_failed_after_relogin: ' + msg2, events };
      }
    } else {
      setLinkedInState('error');
      proxyEmit({ kind: 'error', message: 'research failed: ' + msg, ts: now() });
      return { success: false, drop_reason: 'research_failed: ' + msg, events };
    }
  }
  const { capture, prospect_id, evidence_id, activity_status, autoDropSignals, tenureInCurrentRoleMonths } = research;
  proxyEmit({
    kind: 'evidence_captured',
    message: `${capture.full_name} - ${capture.headline ?? '(no headline)'} - ${activity_status}`,
    payload: { evidence_id, capture, activity_status, autoDropSignals, tenureInCurrentRoleMonths },
    ts: now()
  });

  // Phase 4.5 — auto-drop signals (v2 skill, Apr 30 lock).
  if (autoDropSignals.length > 0) {
    const reason = `auto-drop signal: ${autoDropSignals.map((s) => `${s.pattern} ("${s.evidence}")`).join('; ')}`;
    const decision: GateDecision = { phase: '0.7', decision: 'drop', reason, meta: { autoDropSignals } };
    logGate(null, prospect_id, decision);
    emitGate(proxyEmit, decision);
    return { success: false, drop_reason: reason, prospect_id, evidence_id, events };
  }

  // Phase 0.5 — DNC.
  const d05 = dncCheck(userId, capture.full_name);
  logGate(null, prospect_id, d05); emitGate(proxyEmit, d05);
  if (d05.decision === 'drop') return { success: false, drop_reason: d05.reason, prospect_id, evidence_id, events };

  // Phase 0.6 — expanded prior-contact ladder (4 sources).
  const d06 = priorContactCheck(userId, capture.full_name, capture.url);
  logGate(null, prospect_id, d06); emitGate(proxyEmit, d06);
  if (d06.decision === 'drop') return { success: false, drop_reason: d06.reason, prospect_id, evidence_id, events };

  // Phase 1.5 — TAM-scope.
  const d15 = tamScopeCheck(userId, { company_name: capture.current_company, domain: null });
  logGate(null, prospect_id, d15); emitGate(proxyEmit, d15);
  if (d15.decision === 'drop') return { success: false, drop_reason: d15.reason, prospect_id, evidence_id, events };
  if (d15.meta && (d15.meta as { account_id?: number }).account_id) {
    const accountId = (d15.meta as { account_id: number }).account_id;
    getDb().prepare('UPDATE prospects SET account_id = ? WHERE id = ?').run(accountId, prospect_id);
  }

  // Phase 1.5b — wrong-company cross-check (Apollo vs LinkedIn). Only runs when
  // we have apollo_company recorded (set by Apollo provider during enrichment).
  const apolloCompanyRow = getDb()
    .prepare('SELECT apollo_company FROM prospects WHERE id = ?')
    .get(prospect_id) as { apollo_company: string | null } | undefined;
  const wrongCo = wrongCompanyCheck(apolloCompanyRow?.apollo_company ?? null, capture.current_company);
  if (wrongCo) {
    logGate(null, prospect_id, wrongCo); emitGate(proxyEmit, wrongCo);
    if (wrongCo.decision === 'drop') return { success: false, drop_reason: wrongCo.reason, prospect_id, evidence_id, events };
  }

  // Phase 0.7 — degree.
  const d07 = degreeCheck(capture.connection_degree);
  logGate(null, prospect_id, d07); emitGate(proxyEmit, d07);
  if (d07.decision === 'drop') return { success: false, drop_reason: d07.reason, prospect_id, evidence_id, events };

  // Phase 0.7.5 — deliverability.
  const d075 = deliverabilityCheck(capture.connection_count, capture.follower_count);
  logGate(null, prospect_id, d075); emitGate(proxyEmit, d075);
  if (d075.decision === 'drop') return { success: false, drop_reason: d075.reason, prospect_id, evidence_id, events };

  // Phase 3 — Apollo dedup (provider-driven). Also enriches the prospect row with
  // apollo_company / apollo_title / apollo_employment when the API provider is active.
  const d3 = await apolloDedupCheck(userId, {
    linkedinUrl: capture.url,
    name: capture.full_name,
    company: capture.current_company ?? undefined,
    prospectId: prospect_id
  });
  logGate(null, prospect_id, d3); emitGate(proxyEmit, d3);
  if (d3.decision === 'drop') return { success: false, drop_reason: d3.reason, prospect_id, evidence_id, events };

  // Phase 4.5 — career-arc detection from Rung 4 capture. Catches the personas
  // that look fine at Rung 1 (e.g. "Director of QA" at an insurance co) but
  // reveal claims-ops / banking-compliance / hardware-defense / clinical-pharma
  // trajectories in the full Experience history.
  const apolloEmpRow = getDb()
    .prepare('SELECT apollo_employment FROM prospects WHERE id = ?')
    .get(prospect_id) as { apollo_employment: string | null } | undefined;
  const arcSignals = analyzeCareerArc({
    experienceSubpage: capture.experience_subpage,
    liveHeadline: capture.headline,
    apolloEmployment: apolloEmpRow?.apollo_employment ?? null
  });
  if (arcSignals.length > 0) {
    proxyEmit({
      kind: 'log',
      message: `career-arc signals: ${arcSignals.map((s) => `${s.pattern}(${s.confidence})`).join(', ')}`,
      ts: now()
    });
    const arcDrop = shouldDropOnCareerArc(arcSignals);
    if (arcDrop.drop) {
      const decision: GateDecision = {
        phase: '0.7',  // re-uses the auto-drop slot since this is a persona check
        decision: 'drop',
        reason: arcDrop.reason ?? 'career-arc mismatch',
        meta: { signals: arcSignals }
      };
      logGate(null, prospect_id, decision);
      emitGate(proxyEmit, decision);
      return { success: false, drop_reason: arcDrop.reason ?? undefined, prospect_id, evidence_id, events };
    }
  }

  // Drafting + QA — motion-specific.
  if (req.motion === 'sales_nav_inmail') {
    return await runInMail({
      userId,
      capture,
      activityStatus: activity_status,
      prospectId: prospect_id,
      evidenceId: evidence_id,
      events,
      proxyEmit
    });
  }

  // Default: connection request.
  proxyEmit({ kind: 'phase_started', phase: 'drafting', ts: now() });
  // Prefer Apollo's structured employment data for tenure when available
  // (more precise than the headline regex). Falls back to research.tenureInCurrentRoleMonths.
  const apolloInsights = insightsFromJson(apolloEmpRow?.apollo_employment ?? null);
  const effectiveTenure = apolloInsights.tenureCurrentRoleMonths ?? tenureInCurrentRoleMonths;
  let draft = await buildDraft({
    firstName: capture.first_name || capture.full_name.split(/\s+/)[0],
    capture,
    tenureInCurrentRoleMonths: effectiveTenure
  });
  if (draft.evidenceQuote) setHookQuote(evidence_id, draft.evidenceQuote);
  proxyEmit({ kind: 'draft_ready', payload: draft, ts: now() });

  // Phase 7.5 — confidence gate (with one remediation pass).
  proxyEmit({ kind: 'phase_started', phase: '7.5', ts: now() });
  let conf = await scoreDraft({
    draft,
    evidenceQuote: draft.evidenceQuote,
    liveHeadline: capture.headline,
    hasLiveHeadline: !!capture.headline,
    activityStatus: activity_status
  });
  proxyEmit({ kind: 'qa_finished', payload: conf, ts: now() });

  if (!conf.pass && conf.d1_formula === 10) {
    proxyEmit({ kind: 'log', message: 'Phase 7.5 remediation: regenerating hook with stricter constraints', ts: now() });
    draft = await buildDraft({
      firstName: capture.first_name || capture.full_name.split(/\s+/)[0],
      capture,
      tenureInCurrentRoleMonths: effectiveTenure
    });
    if (draft.evidenceQuote) setHookQuote(evidence_id, draft.evidenceQuote);
    proxyEmit({ kind: 'draft_ready', payload: draft, ts: now() });
    conf = await scoreDraft({
      draft,
      evidenceQuote: draft.evidenceQuote,
      liveHeadline: capture.headline,
      hasLiveHeadline: !!capture.headline,
      activityStatus: activity_status
    });
    proxyEmit({ kind: 'qa_finished', payload: conf, ts: now() });
  }

  const status = conf.pass ? 'draft' : 'dropped';
  const statusReason = conf.pass ? null : `confidence ${conf.overall} < 9.0; ${conf.fail_reasons.join('; ')}`;
  const info = getDb()
    .prepare(
      `INSERT INTO outreach (
        user_id, prospect_id, evidence_id, motion, draft_body, draft_subject,
        hook, dept, char_count, confidence, confidence_notes, status, status_reason, tier
      ) VALUES (?, ?, ?, 'connection_request', ?, NULL, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      prospect_id,
      evidence_id,
      draft.body,
      draft.hook,
      draft.dept,
      draft.char_count,
      conf.overall,
      JSON.stringify(conf),
      status,
      statusReason,
      draft.tier
    );
  const outreachId = Number(info.lastInsertRowid);

  return {
    success: conf.pass,
    outreach_id: outreachId,
    prospect_id,
    evidence_id,
    draft: { ...draft, confidence: conf },
    drop_reason: conf.pass ? undefined : statusReason ?? undefined,
    events
  };
}

interface InMailRunArgs {
  userId: number;
  capture: import('../browser/linkedin').ProfileCapture;
  activityStatus: 'LINKEDIN-QUIET' | 'ACTIVE';
  prospectId: number;
  evidenceId: number;
  events: OrchestratorEvent[];
  proxyEmit: Emit;
}

async function runInMail(args: InMailRunArgs): Promise<OrchestratorResult> {
  const { userId, capture, activityStatus, prospectId, evidenceId, events, proxyEmit } = args;

  proxyEmit({ kind: 'phase_started', phase: 'drafting', message: 'composing InMail', ts: now() });
  const inmail = await buildInMail({
    firstName: capture.first_name || capture.full_name.split(/\s+/)[0],
    capture,
    activityStatus
  });
  if (inmail.evidenceQuote && inmail.evidenceQuote !== 'tenure-only') {
    setHookQuote(evidenceId, inmail.evidenceQuote);
  }
  proxyEmit({
    kind: 'draft_ready',
    payload: { ...inmail, motion: 'sales_nav_inmail', char_count: inmail.body.length, hook: inmail.hook, dept: 'engineering leaders' },
    ts: now()
  });

  // Phase 7.5 — InMail D1 + LLM D2/D3.
  proxyEmit({ kind: 'phase_started', phase: '7.5', ts: now() });
  const d1Result = scoreInMailDraft({ draft: inmail, capture });
  const d2d3 = await scoreD2D3({
    draftBody: inmail.body,
    hook: inmail.hook,
    liveHeadline: capture.headline,
    evidenceQuote: inmail.evidenceQuote,
    activityStatus
  });
  const overall = Number((d1Result.d1_formula * 0.4 + d2d3.d2_evidence * 0.35 + d2d3.d3_specificity * 0.25).toFixed(2));
  const pass = d1Result.d1_formula === 10 && d2d3.d2_evidence >= 9 && overall >= 9.0;
  const fails = [...d1Result.fail_reasons, ...d2d3.fail_reasons];
  const conf = {
    overall,
    d1_formula: d1Result.d1_formula,
    d2_evidence: d2d3.d2_evidence,
    d3_specificity: d2d3.d3_specificity,
    fail_reasons: fails,
    pass
  };
  proxyEmit({ kind: 'qa_finished', payload: conf, ts: now() });

  const status = pass ? 'draft' : 'dropped';
  const statusReason = pass ? null : `confidence ${overall} < 9.0; ${fails.join('; ')}`;
  const info = getDb()
    .prepare(
      `INSERT INTO outreach (
        user_id, prospect_id, evidence_id, motion, draft_body, draft_subject,
        hook, dept, char_count, confidence, confidence_notes, status, status_reason
      ) VALUES (?, ?, ?, 'sales_nav_inmail', ?, ?, ?, 'engineering leaders', ?, ?, ?, ?, ?)`
    )
    .run(
      userId,
      prospectId,
      evidenceId,
      inmail.body,
      inmail.subject,
      inmail.hook,
      inmail.body.length,
      overall,
      JSON.stringify(conf),
      status,
      statusReason
    );
  const outreachId = Number(info.lastInsertRowid);

  return {
    success: pass,
    outreach_id: outreachId,
    prospect_id: prospectId,
    evidence_id: evidenceId,
    draft: {
      motion: 'sales_nav_inmail',
      body: inmail.body,
      subject: inmail.subject,
      hook: inmail.hook,
      dept: 'engineering leaders',
      char_count: inmail.body.length,
      confidence: conf
    },
    drop_reason: pass ? undefined : statusReason ?? undefined,
    events
  };
}

// suppress unused-import warnings on conditional code paths
void INMAIL_HARD_CONSTRAINTS;
