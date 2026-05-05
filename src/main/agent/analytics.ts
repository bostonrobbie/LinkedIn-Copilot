// Analytics rollup. Reads from the outreach + gate_log tables.

import { getDb } from '../db/client';
import type { AnalyticsRollup, Motion } from '@shared/types';

export interface TodaysActions {
  pendingReplies: Array<{ id: number; full_name: string; company_name: string | null; replied_at: string; reply_classification: string | null }>;
  newAccepts: Array<{ id: number; full_name: string; company_name: string | null; accepted_at: string }>;
  draftsAwaitingReview: Array<{ id: number; full_name: string; company_name: string | null; confidence: number | null; tier: string | null }>;
  sendsToday: number;
  sendsCapSoft: number;
  sendsCapHard: number;
  recentDrops: Array<{ id: number; full_name: string; company_name: string | null; reason: string | null }>;
  reEngagement: Array<{ id: number; full_name: string; company_name: string | null; status: string; lastTouch: string }>;
  // Drop-rate health signal — 24h drops vs 24h drafted. Per the v2 BDR skill,
  // >50% drop rate means the sourcing pool is bad → re-source rather than
  // push through.
  dropRate24h: { drafted: number; dropped: number; rate: number; severity: 'ok' | 'warn' | 'alert' };
}

export function buildTodaysActions(userId: number): TodaysActions {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);

  const pendingReplies = db
    .prepare(
      `SELECT o.id, p.full_name, p.company_name, o.replied_at, o.reply_classification
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.user_id = ? AND o.status = 'replied'
       ORDER BY o.replied_at DESC LIMIT 10`
    )
    .all(userId) as Array<{ id: number; full_name: string; company_name: string | null; replied_at: string; reply_classification: string | null }>;

  const newAccepts = db
    .prepare(
      `SELECT o.id, p.full_name, p.company_name, o.accepted_at
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.user_id = ? AND o.status = 'accepted'
       ORDER BY o.accepted_at DESC LIMIT 10`
    )
    .all(userId) as Array<{ id: number; full_name: string; company_name: string | null; accepted_at: string }>;

  const draftsAwaitingReview = db
    .prepare(
      `SELECT o.id, p.full_name, p.company_name, o.confidence, o.tier
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.user_id = ? AND o.status = 'draft'
       ORDER BY o.drafted_at DESC LIMIT 10`
    )
    .all(userId) as Array<{ id: number; full_name: string; company_name: string | null; confidence: number | null; tier: string | null }>;

  const sendsTodayRow = db
    .prepare(
      `SELECT COUNT(*) AS c FROM outreach
       WHERE user_id = ? AND motion = 'connection_request'
       AND status IN ('sent','accepted','replied') AND substr(sent_at, 1, 10) = ?`
    )
    .get(userId, today) as { c: number };

  const recentDrops = db
    .prepare(
      `SELECT o.id, p.full_name, p.company_name, o.status_reason AS reason
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.user_id = ? AND o.status = 'dropped' AND substr(o.drafted_at, 1, 10) = ?
       ORDER BY o.drafted_at DESC LIMIT 5`
    )
    .all(userId, today) as Array<{ id: number; full_name: string; company_name: string | null; reason: string | null }>;

  // Re-engagement scanner: accepts that haven't replied in 60+ days, OR
  // engaged replies (P1) that we never followed up on after 30+ days.
  const reEngagement = db
    .prepare(
      `SELECT o.id, p.full_name, p.company_name, o.status,
              COALESCE(o.replied_at, o.accepted_at) AS lastTouch
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.user_id = ?
         AND (
           (o.status = 'accepted' AND o.accepted_at IS NOT NULL AND o.accepted_at < datetime('now', '-60 days'))
           OR (o.status = 'replied' AND o.reply_classification = 'P1_engaged' AND o.replied_at < datetime('now', '-30 days'))
         )
       ORDER BY lastTouch ASC LIMIT 10`
    )
    .all(userId) as Array<{ id: number; full_name: string; company_name: string | null; status: string; lastTouch: string }>;

  // Drop-rate signal: 24h-window drafted vs 24h-window dropped. Below 20%
  // is healthy; 20-50% is yellow; above 50% means sourcing is bad and the
  // user should re-source rather than push through.
  const dropRateRow = db
    .prepare(
      `SELECT
         SUM(CASE WHEN status IN ('draft','sent','accepted','replied','declined','dropped','failed') THEN 1 ELSE 0 END) AS drafted,
         SUM(CASE WHEN status = 'dropped' THEN 1 ELSE 0 END) AS dropped
       FROM outreach
       WHERE user_id = ? AND drafted_at > datetime('now', '-1 day')`
    )
    .get(userId) as { drafted: number | null; dropped: number | null };
  const drafted = dropRateRow.drafted ?? 0;
  const dropped = dropRateRow.dropped ?? 0;
  const rate = drafted > 0 ? dropped / drafted : 0;
  const severity: 'ok' | 'warn' | 'alert' =
    drafted < 5 ? 'ok' :  // not enough data to fire
    rate > 0.5 ? 'alert' :
    rate > 0.2 ? 'warn' :
    'ok';

  return {
    pendingReplies,
    newAccepts,
    draftsAwaitingReview,
    sendsToday: sendsTodayRow.c,
    sendsCapSoft: 10,
    sendsCapHard: 20,
    recentDrops,
    reEngagement,
    dropRate24h: { drafted, dropped, rate, severity }
  };
}

export function buildAnalytics(userId: number): AnalyticsRollup {
  const db = getDb();

  const totalsRow = db
    .prepare(
      `SELECT
        SUM(CASE WHEN status='draft' OR status='dropped' OR status='sent' OR status='accepted' OR status='replied' OR status='declined' THEN 1 ELSE 0 END) AS drafted,
        SUM(CASE WHEN status='sent' OR status='accepted' OR status='replied' OR status='declined' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status='accepted' OR status='replied' THEN 1 ELSE 0 END) AS accepted,
        SUM(CASE WHEN status='replied' THEN 1 ELSE 0 END) AS replied,
        SUM(CASE WHEN status='declined' THEN 1 ELSE 0 END) AS declined,
        SUM(CASE WHEN status='dropped' THEN 1 ELSE 0 END) AS dropped
       FROM outreach WHERE user_id = ?`
    )
    .get(userId) as Record<string, number | null>;

  const totals = {
    drafted: totalsRow.drafted ?? 0,
    sent: totalsRow.sent ?? 0,
    accepted: totalsRow.accepted ?? 0,
    replied: totalsRow.replied ?? 0,
    declined: totalsRow.declined ?? 0,
    dropped: totalsRow.dropped ?? 0
  };

  const byMotionRows = db
    .prepare(
      `SELECT motion,
              SUM(CASE WHEN status IN ('sent','accepted','replied','declined') THEN 1 ELSE 0 END) AS sent,
              SUM(CASE WHEN status IN ('accepted','replied') THEN 1 ELSE 0 END) AS accepted,
              SUM(CASE WHEN status='replied' THEN 1 ELSE 0 END) AS replied
       FROM outreach WHERE user_id = ? GROUP BY motion`
    )
    .all(userId) as Array<{ motion: Motion; sent: number; accepted: number; replied: number }>;
  const byMotion = byMotionRows.map((r) => ({
    motion: r.motion,
    sent: r.sent,
    accepted: r.accepted,
    replied: r.replied,
    acceptRate: r.sent > 0 ? Number(((r.accepted / r.sent) * 100).toFixed(1)) : 0,
    replyRate: r.sent > 0 ? Number(((r.replied / r.sent) * 100).toFixed(1)) : 0
  }));

  const recentSends = db
    .prepare(
      `SELECT date(sent_at) AS day,
              COUNT(*) AS sent,
              SUM(CASE WHEN status IN ('accepted','replied') THEN 1 ELSE 0 END) AS accepted,
              SUM(CASE WHEN status='replied' THEN 1 ELSE 0 END) AS replied
       FROM outreach
       WHERE user_id = ? AND sent_at IS NOT NULL
       GROUP BY date(sent_at) ORDER BY day DESC LIMIT 14`
    )
    .all(userId) as Array<{ day: string; sent: number; accepted: number; replied: number }>;

  const dropReasons = db
    .prepare(
      `SELECT
        CASE
          WHEN status_reason LIKE '%DNC%' THEN 'DNC'
          WHEN status_reason LIKE '%prior contact%' THEN 'Prior contact'
          WHEN status_reason LIKE '%TAM%' OR status_reason LIKE '%out of scope%' THEN 'Out of TAM'
          WHEN status_reason LIKE '%1st-degree%' THEN '1st-degree'
          WHEN status_reason LIKE '%near-empty%' THEN 'Low-engagement profile'
          WHEN status_reason LIKE '%confidence%' THEN 'Low confidence'
          ELSE 'Other'
        END AS reason,
        COUNT(*) AS count
       FROM outreach
       WHERE user_id = ? AND status = 'dropped'
       GROUP BY reason ORDER BY count DESC`
    )
    .all(userId) as Array<{ reason: string; count: number }>;

  return { totals, byMotion, recentSends, dropReasons };
}
