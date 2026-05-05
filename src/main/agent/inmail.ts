// InMail drafting. Heavier than connect-request — 5-paragraph body + subject.
// LLM-driven when API key is set; heuristic fallback otherwise (LINKEDIN-QUIET tenure floor).

import Anthropic from '@anthropic-ai/sdk';
import log from 'electron-log';
import type { ProfileCapture } from '../browser/linkedin';
import { getClient, SONNET } from './llm';

// Local backoff helper for InMail — same shape as llm.ts callWithRetry.
async function callWithRetry<T>(label: string, fn: () => Promise<T>, maxRetries = 4): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      const err = e as { status?: number; message?: string };
      const status = typeof err?.status === 'number' ? err.status : undefined;
      const transient =
        status === 429 ||
        (status !== undefined && status >= 500) ||
        /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i.test(err?.message ?? '');
      if (!transient || attempt >= maxRetries) throw e;
      const waitMs = Math.pow(2, attempt) * 1000;
      log.info(`${label} transient (status=${status}) — retry in ${waitMs / 1000}s`);
      await new Promise((r) => setTimeout(r, waitMs));
      attempt++;
    }
  }
}

export interface InMailDraft {
  motion: 'sales_nav_inmail';
  subject: string;
  body: string;
  hook: string;
  hookTier: 'A' | 'A+' | 'A++';
  evidenceQuote: string;
  source: 'llm' | 'heuristic';
  char_count: number;
}

const SYSTEM_PROMPT = `You are a senior BDR coach drafting Sales Navigator InMails for Testsigma (an AI-powered test automation platform).

Output a 5-paragraph InMail using THIS exact body structure (paragraphs separated by blank lines):

  Para 1 (Opener): "Hi {First}, I'm at Testsigma, AI-powered test automation. {hook_sentence}. Hopefully its not too much to ask how testing has been holding up at {Company} {tenure_or_activity_context}?"

  Para 2 (Connector): "Reason I'm asking, when {company_category_summary} spans {tech_areas}, the testing surface tends to multiply fast. {area1}, {area2}, {area3}, all hitting cross-stack scenarios at the same time."

  Para 3 (Proof): "CRED is one example. As their FinTech app scaled, they got to 90% automated regression coverage with 5x faster execution once AI took over the test authoring and self-healing work their team had been carrying manually."

  Para 4 (Capability): "Testsigma's Agent does that across web, mobile, and API. Plain-English test authoring, AI self-healing when locators break, and coverage gaps surfaced automatically as new features ship."

  Para 5 (Close): "Curious if any of that sounds like what your team is running into at {Company}?"

  Sign-off: "Best,
Rob"

HARD RULES:
- The phrase "Hopefully its not too much to ask" uses LOWERCASE "its" — this is intentional voice, not a typo. Keep it lowercase.
- ZERO em dashes anywhere (use commas).
- Subject: 4-10 words, anchors on the same hook, no em dashes, no period.
- Body length: 700-1100 characters total.
- Hook tier:
    "A++" if recent (≤90d) recipient-published or recipient-amplified LinkedIn activity is in the input.
    "A+" if substantive recent activity but not directly recipient-relevant.
    "A" (LINKEDIN-QUIET) if no substantive activity. Use tenure-only ("two-plus years in"), do NOT fabricate "saw your post".
- {tenure_or_activity_context} examples: "two-plus years in" (Tier A) or "as that integration ships" (Tier A++).
- {hook_sentence} examples:
    Tier A++: "Saw your repost about SailPoint Identity Security Accelerator landing in the AWS Security Hub Extended plan, congrats."
    Tier A:  (omit hook_sentence entirely; opener becomes "Hi {First}, I'm at Testsigma, AI-powered test automation. Hopefully its not too much to ask...")
- {company_category_summary}: e.g., "an identity security platform", "a unified access orchestration platform", "a mainframe modernization platform"
- {tech_areas}: comma-separated list of 3-4 specific surfaces, e.g., "cloud security telemetry, identity governance, and a network of integrations"
- {area1/area2/area3}: 3 specific QA pain areas tied to the company's stack, e.g., "SaaS UI, API connectors, governance workflows"

Return STRICTLY a JSON object:
{
  "subject": "<4-10 word subject>",
  "body": "<full 5-paragraph body with sign-off>",
  "hook": "<the noun-phrase hook from the opener — what 'caught your attention'>",
  "hook_tier": "A" | "A+" | "A++",
  "evidence_quote": "<verbatim string from input that supports the hook (or 'tenure-only' for Tier A)>"
}`;

export async function buildInMail(args: {
  firstName: string;
  capture: ProfileCapture;
  activityStatus: 'LINKEDIN-QUIET' | 'ACTIVE';
}): Promise<InMailDraft> {
  const { firstName, capture, activityStatus } = args;
  const c = getClient();

  if (!c) {
    return heuristicInMail(firstName, capture, activityStatus);
  }

  const userPayload = JSON.stringify(
    {
      first_name: firstName,
      full_name: capture.full_name,
      live_headline: capture.headline,
      about: capture.about,
      current_title: capture.current_title,
      current_company: capture.current_company,
      recent_activity: capture.recent_activity_text,
      activity_status: activityStatus
    },
    null,
    2
  );

  try {
    const resp = await callWithRetry('inmail-gen', () =>
      c.messages.create({
        model: SONNET,
        max_tokens: 1200,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPayload }]
      })
    );
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const json = extractJson(text);
    if (!json || typeof json !== 'object') throw new Error('inmail returned non-JSON');
    const obj = json as {
      subject?: string;
      body?: string;
      hook?: string;
      hook_tier?: 'A' | 'A+' | 'A++';
      evidence_quote?: string;
    };
    if (!obj.subject || !obj.body) throw new Error('subject or body missing');
    const body = obj.body.trim();
    return {
      motion: 'sales_nav_inmail',
      subject: obj.subject.trim(),
      body,
      hook: (obj.hook ?? '').trim(),
      hookTier: obj.hook_tier ?? 'A',
      evidenceQuote: (obj.evidence_quote ?? '').trim(),
      source: 'llm',
      char_count: body.length
    };
  } catch (err) {
    log.warn('buildInMail llm failed; falling back', err);
    return heuristicInMail(firstName, capture, activityStatus);
  }
}

function heuristicInMail(
  firstName: string,
  capture: ProfileCapture,
  _activityStatus: 'LINKEDIN-QUIET' | 'ACTIVE'
): InMailDraft {
  const company = capture.current_company || 'your team';
  const subject = `Two-plus years scaling ${company}`.split(/\s+/).slice(0, 8).join(' ');
  const body =
    `Hi ${firstName}, I'm at Testsigma, AI-powered test automation. Hopefully its not too much to ask how testing has been holding up at ${company} as the team continues to scale?\n\n` +
    `Reason I'm asking, when a software platform spans web, mobile, API, and integrations, the testing surface tends to multiply fast. UI workflows, API contracts, integration scenarios, all hitting cross-stack at the same time.\n\n` +
    `CRED is one example. As their FinTech app scaled, they got to 90% automated regression coverage with 5x faster execution once AI took over the test authoring and self-healing work their team had been carrying manually.\n\n` +
    `Testsigma's Agent does that across web, mobile, and API. Plain-English test authoring, AI self-healing when locators break, and coverage gaps surfaced automatically as new features ship.\n\n` +
    `Curious if any of that sounds like what your team is running into at ${company}?\n\n` +
    `Best,\nRob`;
  return {
    motion: 'sales_nav_inmail',
    subject,
    body,
    hook: 'tenure-only',
    hookTier: 'A',
    evidenceQuote: 'tenure-only',
    source: 'heuristic',
    char_count: body.length
  };
}

function extractJson(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

export const INMAIL_HARD_CONSTRAINTS = {
  bodyMinChars: 700,
  bodyMaxChars: 1100,
  subjectMinWords: 4,
  subjectMaxWords: 10,
  forbiddenChars: ['—'],
  requiredPhrases: [
    "AI-powered test automation",
    "Hopefully its not too much to ask",
    "Testsigma's Agent",
    'Best,\nRob'
  ]
};

export interface InMailQAInput {
  draft: InMailDraft;
  capture: ProfileCapture;
}

export function scoreInMailDraft(input: InMailQAInput): {
  d1_formula: number;
  fail_reasons: string[];
} {
  const { draft } = input;
  const fails: string[] = [];
  let d1 = 10;
  const c = INMAIL_HARD_CONSTRAINTS;

  if (draft.body.length < c.bodyMinChars) {
    d1 -= 3;
    fails.push(`body too short (${draft.body.length} < ${c.bodyMinChars})`);
  }
  if (draft.body.length > c.bodyMaxChars) {
    d1 -= 2;
    fails.push(`body too long (${draft.body.length} > ${c.bodyMaxChars})`);
  }
  const subjectWords = draft.subject.split(/\s+/).filter(Boolean).length;
  if (subjectWords < c.subjectMinWords) {
    d1 -= 3;
    fails.push(`subject too short (${subjectWords} < ${c.subjectMinWords})`);
  }
  if (subjectWords > c.subjectMaxWords) {
    d1 -= 3;
    fails.push(`subject too long (${subjectWords} > ${c.subjectMaxWords})`);
  }
  for (const ch of c.forbiddenChars) {
    if (draft.body.includes(ch) || draft.subject.includes(ch)) {
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
  d1 = Math.max(0, d1);
  return { d1_formula: d1, fail_reasons: fails };
}
