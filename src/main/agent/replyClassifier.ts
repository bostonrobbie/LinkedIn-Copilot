// Reply classifier. When the sync worker detects a new reply, run it through
// Opus to categorize P0 (warm/booking) / P1 (engaged) / P2 (decline) /
// P3 (auto-reply / OOO / not-the-right-person) / P4 (hostile / unsubscribe).
//
// Hostile or unsubscribe replies trigger an automatic DNC entry so we never
// re-touch the prospect.

import Anthropic from '@anthropic-ai/sdk';
import log from 'electron-log';
import { z } from 'zod';
import { getDb } from '../db/client';
import { getClient, OPUS } from './llm';

export type ReplyClass = 'P0_warm' | 'P1_engaged' | 'P2_decline' | 'P3_auto_reply' | 'P4_hostile';

const SYSTEM = `You classify LinkedIn replies received in response to a Testsigma BDR's connection-request or InMail outreach.

Pick exactly one bucket:

  P0_warm        — they want to talk. "yes please", "send me a calendar link", "interested", "I'm in the market".
  P1_engaged     — they're responding substantively but not yet a meeting ask. Asking questions about the product, sharing context about their stack, asking for a deck.
  P2_decline     — polite no. "not now", "we use X already", "thanks but no thanks", "not the right fit". Not hostile.
  P3_auto_reply  — out-of-office, autoresponder, "I'm on parental leave until…", "wrong person, please contact X". The human didn't actually engage.
  P4_hostile     — angry, accusatory, "stop spamming me", "remove me from your list", calling it AI bot spam, blocking. Anything that signals re-touching is harmful.

Return STRICTLY a JSON object:
{
  "classification": "<one of the five buckets>",
  "confidence": <0.0 - 1.0>,
  "reasoning": "<one short sentence>",
  "should_dnc": <true if P4 hostile OR explicit unsubscribe / 'remove me' language; else false>
}`;

const ResultSchema = z.object({
  classification: z.enum(['P0_warm', 'P1_engaged', 'P2_decline', 'P3_auto_reply', 'P4_hostile']),
  confidence: z.number().min(0).max(1).default(0.7),
  reasoning: z.string().default(''),
  should_dnc: z.boolean().default(false)
});

export interface ReplyClassifyInput {
  prospectName: string;
  prospectCompany: string | null;
  replyBody: string;
  motion: 'connection_request' | 'sales_nav_inmail';
  draftBody: string;
}

export interface ReplyClassifyResult {
  classification: ReplyClass;
  confidence: number;
  reasoning: string;
  shouldDnc: boolean;
  source: 'llm' | 'heuristic';
}

function heuristic(input: ReplyClassifyInput): ReplyClassifyResult {
  const t = input.replyBody.toLowerCase();
  // P4 hostile signals (highest priority — overrides everything else).
  if (/spam|stop messaging|stop emailing|stop sending|remove me|unsubscribe|harassment|bot|cease|reported you|report you/i.test(t)) {
    return { classification: 'P4_hostile', confidence: 0.85, reasoning: 'matched hostile keyword', shouldDnc: true, source: 'heuristic' };
  }
  // P3 auto-reply (check before P0/P2 since OOO can mention "interested" or "no").
  if (/out of (the )?office|on (parental|maternity|vacation|leave)|automatic reply|autoresponder|away from my desk|will be back/i.test(t)) {
    return { classification: 'P3_auto_reply', confidence: 0.8, reasoning: 'matched OOO keyword', shouldDnc: false, source: 'heuristic' };
  }
  // P2 decline (check BEFORE P0 because "not interested" contains "interested").
  if (/not (now|interested|a fit|right)|already (have|use)|we'?re good|no thanks|pass\b|appreciate (the|but).*not|appreciate (the|but).*good/i.test(t)) {
    return { classification: 'P2_decline', confidence: 0.7, reasoning: 'matched decline keyword', shouldDnc: false, source: 'heuristic' };
  }
  // P0 warm signals.
  if (/calendar|\bbook(\s|ed|ing)?\b|schedule|let'?s set|send me a link|sounds great|love to chat|grab some time|talk next week|meet (next|this) week|let'?s (talk|chat|meet)|interested in (learning|hearing|seeing)/i.test(t)) {
    return { classification: 'P0_warm', confidence: 0.8, reasoning: 'matched meeting-ask keyword', shouldDnc: false, source: 'heuristic' };
  }
  // Default: P1 engaged.
  return { classification: 'P1_engaged', confidence: 0.5, reasoning: 'no strong keyword signal — defaulting to engaged', shouldDnc: false, source: 'heuristic' };
}

export async function classifyReply(input: ReplyClassifyInput): Promise<ReplyClassifyResult> {
  const c = getClient();
  if (!c) return heuristic(input);
  try {
    const resp = await c.messages.create({
      model: OPUS,
      max_tokens: 300,
      temperature: 0,
      system: SYSTEM,
      messages: [{ role: 'user', content: JSON.stringify(input, null, 2) }]
    });
    const text = resp.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1) throw new Error('no JSON in classifier response');
    const parsed = ResultSchema.safeParse(JSON.parse(text.slice(start, end + 1)));
    if (!parsed.success) throw new Error('schema invalid');
    return {
      classification: parsed.data.classification,
      confidence: parsed.data.confidence,
      reasoning: parsed.data.reasoning,
      shouldDnc: parsed.data.should_dnc,
      source: 'llm'
    };
  } catch (err) {
    log.warn('classifyReply llm failed; falling back to heuristic', err);
    return heuristic(input);
  }
}

// Persist classification on the outreach row + auto-DNC if hostile / unsubscribe.
export async function classifyAndPersist(userId: number, outreachId: number): Promise<ReplyClassifyResult | null> {
  const conn = getDb();
  const row = conn
    .prepare(
      `SELECT o.id, o.motion, o.draft_body, o.reply_body, p.full_name, p.company_name
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.id = ? AND o.user_id = ?`
    )
    .get(outreachId, userId) as
    | { id: number; motion: 'connection_request' | 'sales_nav_inmail'; draft_body: string; reply_body: string | null; full_name: string; company_name: string | null }
    | undefined;
  if (!row || !row.reply_body) return null;
  const result = await classifyReply({
    prospectName: row.full_name,
    prospectCompany: row.company_name,
    replyBody: row.reply_body,
    motion: row.motion,
    draftBody: row.draft_body
  });
  conn
    .prepare(
      `UPDATE outreach SET reply_classification = ?, reply_classified_at = datetime('now') WHERE id = ?`
    )
    .run(result.classification, outreachId);
  log.info(`reply classified outreach ${outreachId}: ${result.classification} (${result.source}, conf=${result.confidence})`);

  // Auto-DNC on hostile / unsubscribe.
  if (result.shouldDnc) {
    try {
      conn
        .prepare(
          `INSERT OR IGNORE INTO dnc (user_id, name_norm, display_name, company, reason, auto_added_from_outreach_id, auto_added_reason_kind)
           VALUES (?, ?, ?, ?, ?, ?, 'hostile_reply')`
        )
        .run(
          userId,
          row.full_name.trim().toLowerCase(),
          row.full_name,
          row.company_name,
          `auto-DNC from ${result.classification}: ${result.reasoning.slice(0, 200)}`,
          outreachId
        );
      log.warn(`auto-DNC added from hostile reply: ${row.full_name} (outreach ${outreachId})`);
    } catch (err) {
      log.warn('auto-DNC insert failed', err);
    }
  }

  return result;
}
