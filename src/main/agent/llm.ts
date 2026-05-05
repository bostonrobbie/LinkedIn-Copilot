// Anthropic SDK wrapper. The agent gracefully degrades when the API key isn't set:
// - hook generation falls back to a heuristic
// - D2/D3 QA scoring falls back to deterministic placeholders
//
// Model split (per the demo plan):
//   Sonnet 4.6 — research extraction, hook generation
//   Opus 4.7   — D2 evidence traceability + D3 specificity scoring (gated, only on clean drafts)

import Anthropic from '@anthropic-ai/sdk';
import log from 'electron-log';
import { z } from 'zod';
import { getDb } from '../db/client';
import { decryptKey } from '../secrets';

export const SONNET = 'claude-sonnet-4-6';
export const OPUS = 'claude-opus-4-7';

// Schemas for the LLM outputs we expect. Used to validate + auto-retry once
// when Claude returns malformed JSON (rare, but it happens).

const HookSchema = z.object({
  hook: z.string().min(3).max(120),
  evidence_quote: z.string().default(''),
  reasoning: z.string().default(''),
  tenure_bucket: z.enum(['GREEN', 'YELLOW', 'RED', 'UNKNOWN']).optional()
});

const D2D3Schema = z.object({
  d2_evidence: z.number().int().min(0).max(10),
  d3_specificity: z.number().int().min(0).max(10),
  fail_reasons: z.array(z.string()).default([])
});

// Status callback so the orchestrator can surface "rate limited, retrying in Xs"
// to the wizard's event stream.
type LlmStatusCallback = (msg: string) => void;
let statusCb: LlmStatusCallback | null = null;
export function setLlmStatusCallback(cb: LlmStatusCallback | null): void {
  statusCb = cb;
}
function emitStatus(msg: string): void {
  log.info('llm:', msg);
  try { statusCb?.(msg); } catch { /* swallow */ }
}

interface AnthropicErrorLike {
  status?: number;
  message?: string;
  name?: string;
  headers?: Record<string, string>;
}

// Exponential backoff: 1s, 2s, 4s, 8s. Max 4 retries on 429 / 5xx / network.
async function callWithRetry<T>(
  label: string,
  fn: () => Promise<T>,
  maxRetries = 4
): Promise<T> {
  let attempt = 0;
  while (true) {
    try {
      return await fn();
    } catch (e) {
      const err = e as AnthropicErrorLike;
      const status = typeof err?.status === 'number' ? err.status : undefined;
      const transient =
        status === 429 ||
        (status !== undefined && status >= 500) ||
        /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed|socket hang up/i.test(err?.message ?? '');
      if (!transient || attempt >= maxRetries) {
        throw e;
      }
      const waitMs = Math.pow(2, attempt) * 1000;
      const reasonShort =
        status === 429 ? 'rate limited' :
        status && status >= 500 ? `server ${status}` :
        'network error';
      emitStatus(`${label} ${reasonShort} — retry in ${waitMs / 1000}s (attempt ${attempt + 1}/${maxRetries})`);
      await new Promise((r) => setTimeout(r, waitMs));
      attempt++;
    }
  }
}

let client: Anthropic | null = null;
let lastKey: string | null = null;

function readKey(): string | null {
  const row = getDb()
    .prepare("SELECT anthropic_api_key, anthropic_api_key_enc FROM users ORDER BY id LIMIT 1")
    .get() as { anthropic_api_key: string | null; anthropic_api_key_enc: Buffer | null } | undefined;
  // Prefer encrypted column; fall back to legacy plaintext (pre-migration-002), then env.
  const dec = decryptKey(row?.anthropic_api_key_enc);
  return (dec ?? row?.anthropic_api_key ?? '').trim() || process.env.ANTHROPIC_API_KEY || null;
}

export function getClient(): Anthropic | null {
  const key = readKey();
  if (!key) return null;
  if (client && lastKey === key) return client;
  lastKey = key;
  client = new Anthropic({ apiKey: key });
  return client;
}

export function isAnthropicAvailable(): boolean {
  return getClient() !== null;
}

export interface HookGenInput {
  firstName: string;
  fullName: string;
  liveHeadline: string | null;
  about: string | null;
  currentTitle: string | null;
  currentCompany: string | null;
  recentActivity: string[];
  activityStatus: 'LINKEDIN-QUIET' | 'ACTIVE';
  tenureInCurrentRoleMonths?: number | null;
}

export interface HookGenResult {
  hook: string;
  evidenceQuote: string;
  reasoning: string;
  source: 'llm' | 'heuristic';
  tenureBucket?: 'GREEN' | 'YELLOW' | 'RED' | 'UNKNOWN';
}

const HOOK_SYSTEM = `You are a senior BDR coach drafting LinkedIn connection requests for Testsigma (an AI-powered test automation company). You are following the locked v2 LinkedIn Connection-Request Batch skill from the BDR repo (Apr 30, 2026 lock).

Your job: produce a short, specific HOOK PHRASE that fits this exact sentence in the locked formula:

  "Your <HOOK> is what caught my attention."

HARD RULES:
- The hook is a single noun phrase (no period, no question mark, no second clause).
- 4-12 words.
- Lowercase the first letter (it follows "Your ").
- It must trace VERBATIM (or near-verbatim) to a specific phrase in the prospect's LinkedIn data. NO fabrication, NO inference beyond what's in the input.
- Avoid generic claims ("leadership in QA", "engineering excellence"). Specific > clever.
- Forbidden words/phrases: "synergy", "leverage", "thought leadership", "I noticed", "I saw", "I came across".

HOOK QUALITY FRAMEWORK — pick the bucket by tenure_in_current_role_months:

  TENURE < 12 MONTHS  (GREEN)  → "recent move into..." / "recent promotion to..." / "move up to..."
    Example: "recent move into QA Automation Lead at Chase"
    Example: "recent move into Staff QA at GE Aerospace after years at GE Digital"

  TENURE 12-24 MONTHS  (YELLOW)  → "role as X at Y" / "Y-month run as X"
    NEVER use "move" or "step up" in this bucket.
    Example: "role as Senior Software Engineering Manager at SugarCRM"

  TENURE > 24 MONTHS  (RED)  → "X-plus years as..." / "X-year run as..."
    Emphasize tenure depth.
    Example: "twenty-plus years at Fidelity as a Test Engineer"
    Example: "ten-plus years as Senior Software Engineering Manager at GEICO"

  IF TENURE UNKNOWN: default to YELLOW pattern, framing on role+company without time markers.

ACTIVITY-ANCHORED HOOKS (preferred when available):
  - When activity_status is ACTIVE and the input contains substantive recent posts/reposts/comments, anchor the hook on the verbatim activity content.
  - Examples: "repost about SailPoint Identity Security Accelerator landing in the AWS Security Hub Extended plan", "post about the Vilnius SDSF meetup with Rob Scott"

LINKEDIN-QUIET FLOOR:
  - When activity_status is LINKEDIN-QUIET, never claim "saw your post" or "noticed your repost".
  - Anchor strictly on tenure (preferred) or verbatim Experience-entry title.

SPECIAL HOOK TYPES (any tenure):
  - Stack/skill hook: when headline lists distinctive tools (e.g., "Playwright, Selenium, and TOSCA stack at Mindbody")
  - Career arc hook: for veteran careers with notable progression (e.g., "arc from Software Certification Engineer to Lead QA at GE Aerospace")
  - Dual-role hook: for explicit dual title (e.g., "recent move into QA Manager and Technical Product Lead at bp")
  - Cross-company hook: when prior role at notable company adds context (e.g., "QA leadership at Cboe after eighteen years at Hotspot FX")

You return STRICTLY a JSON object:
{
  "hook": "<the hook phrase>",
  "evidence_quote": "<the verbatim string from the input that supports the hook>",
  "tenure_bucket": "GREEN" | "YELLOW" | "RED" | "UNKNOWN",
  "reasoning": "<one sentence: why this hook is recipient-specific and which bucket framing was chosen>"
}`;

export async function generateHook(input: HookGenInput): Promise<HookGenResult> {
  const c = getClient();
  if (!c) {
    return {
      hook: heuristicFallback(input),
      evidenceQuote: input.liveHeadline ?? '',
      reasoning: 'heuristic fallback (no API key)',
      source: 'heuristic'
    };
  }

  const userPayload = JSON.stringify(input, null, 2);
  const tryOnce = async (extraInstruction = ''): Promise<{ ok: true; data: z.infer<typeof HookSchema> } | { ok: false; reason: string }> => {
    try {
      const resp = await callWithRetry('hook-gen', () =>
        c.messages.create({
          model: SONNET,
          max_tokens: 400,
          temperature: 0,
          system: HOOK_SYSTEM + (extraInstruction ? '\n\n' + extraInstruction : ''),
          messages: [{ role: 'user', content: userPayload }]
        })
      );
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const json = extractJson(text);
      if (!json) return { ok: false, reason: 'no JSON object found in response' };
      const parsed = HookSchema.safeParse(json);
      if (!parsed.success) {
        return { ok: false, reason: 'schema invalid: ' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
      }
      return { ok: true, data: parsed.data };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  };

  let attempt = await tryOnce();
  if (!attempt.ok) {
    log.warn('generateHook attempt 1 failed:', attempt.reason);
    attempt = await tryOnce('Your previous response was malformed. Respond with ONLY a single JSON object matching the documented schema, no prose, no markdown fences.');
  }
  if (!attempt.ok) {
    log.warn('generateHook llm failed twice; falling back. last reason:', attempt.reason);
    return {
      hook: heuristicFallback(input),
      evidenceQuote: input.liveHeadline ?? '',
      reasoning: 'heuristic fallback (llm error: ' + attempt.reason + ')',
      source: 'heuristic'
    };
  }
  const obj = attempt.data;
  return {
    hook: obj.hook.trim(),
    evidenceQuote: obj.evidence_quote.trim(),
    reasoning: obj.reasoning.trim(),
    source: 'llm',
    tenureBucket: obj.tenure_bucket
  };
}

function heuristicFallback(input: HookGenInput): string {
  const h = input.liveHeadline ?? '';
  const trimmed = h.replace(/\s*[—|·]\s*/g, ' ').replace(/\s+at\s+[^,|]+/i, '').split(/[,|]/)[0].trim();
  if (!trimmed) return 'work in QA leadership';
  const lower = trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
  return lower.length > 60 ? lower.slice(0, 60).replace(/\s+\S*$/, '') : lower;
}

export interface D2D3Input {
  draftBody: string;
  hook: string;
  liveHeadline: string | null;
  evidenceQuote: string | null;
  activityStatus: 'LINKEDIN-QUIET' | 'ACTIVE';
}

export interface D2D3Result {
  d2_evidence: number;       // 0-10
  d3_specificity: number;    // 0-10
  fail_reasons: string[];
  source: 'llm' | 'heuristic';
}

const QA_SYSTEM = `You audit LinkedIn connection-request drafts for a BDR at Testsigma. You score TWO dimensions:

D2 — Evidence traceability (0-10):
  10 = every concrete claim in the hook traces verbatim or near-verbatim to the supplied evidence_quote
       OR is a verified tenure-only claim (acceptable LINKEDIN-QUIET floor at ≤9).
  Below 9 means inference, paraphrase that drifts from evidence, or fabrication.
  Any unverifiable claim ("saw your post about X") on a LINKEDIN-QUIET profile = AUTO-FAIL (return d2 = 3).

D3 — Specificity (0-10):
  10 = recipient-specific anchor (a fact unique to this person)
  9 = role/tenure-specific
  7 = company-generic
  5 = persona-generic ("leadership in QA")
  Below 5 = boilerplate

Return STRICTLY a JSON object:
{
  "d2_evidence": <int 0-10>,
  "d3_specificity": <int 0-10>,
  "fail_reasons": [<short strings>]
}`;

export async function scoreD2D3(input: D2D3Input): Promise<D2D3Result> {
  const c = getClient();
  if (!c) {
    return heuristicQA(input);
  }
  const tryOnce = async (extraInstruction = ''): Promise<{ ok: true; data: z.infer<typeof D2D3Schema> } | { ok: false; reason: string }> => {
    try {
      const resp = await callWithRetry('qa-score', () =>
        c.messages.create({
          model: OPUS,
          max_tokens: 400,
          temperature: 0,
          system: QA_SYSTEM + (extraInstruction ? '\n\n' + extraInstruction : ''),
          messages: [{ role: 'user', content: JSON.stringify(input, null, 2) }]
        })
      );
      const text = resp.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');
      const json = extractJson(text);
      if (!json) return { ok: false, reason: 'no JSON object found' };
      const parsed = D2D3Schema.safeParse(json);
      if (!parsed.success) {
        return { ok: false, reason: 'schema invalid: ' + parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ') };
      }
      return { ok: true, data: parsed.data };
    } catch (e) {
      return { ok: false, reason: e instanceof Error ? e.message : String(e) };
    }
  };

  let attempt = await tryOnce();
  if (!attempt.ok) {
    log.warn('scoreD2D3 attempt 1 failed:', attempt.reason);
    attempt = await tryOnce('Your previous response was malformed. Respond with ONLY a single JSON object matching the documented schema, no prose.');
  }
  if (!attempt.ok) {
    log.warn('scoreD2D3 llm failed twice; falling back. last reason:', attempt.reason);
    return heuristicQA(input);
  }
  const obj = attempt.data;
  return {
    d2_evidence: clamp(obj.d2_evidence, 0, 10),
    d3_specificity: clamp(obj.d3_specificity, 0, 10),
    fail_reasons: obj.fail_reasons,
    source: 'llm'
  };
}

function heuristicQA(input: D2D3Input): D2D3Result {
  let d2 = 7;
  if (input.evidenceQuote && input.evidenceQuote.toLowerCase().includes(input.hook.toLowerCase())) d2 = 9;
  else if (input.liveHeadline) d2 = 9;
  let d3 = 9;
  if (input.hook.length < 12) d3 = 7;
  if (/work in qa leadership|leadership role/i.test(input.hook)) d3 = 7;
  return { d2_evidence: d2, d3_specificity: d3, fail_reasons: [], source: 'heuristic' };
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
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
