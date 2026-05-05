// QA / confidence scorer. D1 (formula compliance) is fully deterministic.
// D2 (evidence traceability) and D3 (specificity) prefer the LLM scorer; fall
// back to heuristics when no API key is configured.

import type { ConfidenceScore, Draft } from '@shared/types';
import { TEMPLATE_HARD_CONSTRAINTS } from './drafting';
import { scoreD2D3 } from './llm';

interface Inputs {
  draft: Draft;
  evidenceQuote: string | null;
  liveHeadline: string | null;
  hasLiveHeadline: boolean;
  activityStatus: 'LINKEDIN-QUIET' | 'ACTIVE';
}

export async function scoreDraft(inputs: Inputs): Promise<ConfidenceScore> {
  const { draft } = inputs;
  const fails: string[] = [];

  // D1 — formula compliance (deterministic).
  let d1 = 10;
  const c = TEMPLATE_HARD_CONSTRAINTS;
  if (draft.char_count < c.minChars) {
    d1 -= 3;
    fails.push(`char_count ${draft.char_count} < ${c.minChars}`);
  }
  if (draft.char_count > c.maxChars) {
    d1 -= 3;
    fails.push(`char_count ${draft.char_count} > ${c.maxChars}`);
  }
  for (const ch of c.forbiddenChars) {
    if (draft.body.includes(ch)) {
      d1 -= 4;
      fails.push(`contains forbidden character "${ch}"`);
    }
  }
  for (const p of c.requiredPhrases) {
    if (!draft.body.includes(p)) {
      d1 -= 4;
      fails.push(`missing required phrase: "${p}"`);
    }
  }
  if (!draft.body.endsWith(c.signoff)) {
    d1 -= 4;
    fails.push(`signoff must end with "${c.signoff}"`);
  }
  if (/[.?!]/.test(draft.hook)) {
    d1 -= 2;
    fails.push('hook must be a noun phrase, not a sentence');
  }
  if (draft.hook.length < 5) {
    d1 -= 3;
    fails.push('hook is too short');
  }
  d1 = Math.max(0, d1);

  // D2 + D3 — Anthropic if available, else heuristic.
  const llm = await scoreD2D3({
    draftBody: draft.body,
    hook: draft.hook,
    liveHeadline: inputs.liveHeadline,
    evidenceQuote: inputs.evidenceQuote,
    activityStatus: inputs.activityStatus
  });
  const d2 = llm.d2_evidence;
  const d3 = llm.d3_specificity;
  for (const r of llm.fail_reasons) fails.push(r);

  const overall = Number((d1 * 0.4 + d2 * 0.35 + d3 * 0.25).toFixed(2));
  const pass = d1 === 10 && d2 >= 9 && overall >= 9.0;

  return {
    overall,
    d1_formula: d1,
    d2_evidence: d2,
    d3_specificity: d3,
    fail_reasons: fails,
    pass
  };
}
