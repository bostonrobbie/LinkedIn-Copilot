// Send orchestrator. Dispatches on motion. Both branches use INC-022-style readback
// (extract -> inject -> readback -> char-for-char compare -> send only on match).
// Also enforces INC-028 daily-send-throttle (~5–10/day for connection requests).

import { getDb } from '../db/client';
import { sendConnectionRequest, sendSalesNavInMail, controlProfileCheck } from '../browser/linkedin';
import { withWatchdog, WATCHDOG, WatchdogTimeout } from '../browser/watchdog';
import { enqueueSend } from './sendQueue';
import log from 'electron-log';

// INC-028 throttle. LinkedIn caps invites at ~100 per rolling 7-day window.
// We're conservative: 10/day soft, 20/day hard, 80/7d weekly soft, 100/7d weekly hard.
const INC_028_SOFT_CAP = 10;
const INC_028_HARD_CAP = 20;
const INC_028_WEEKLY_SOFT_CAP = 80;
const INC_028_WEEKLY_HARD_CAP = 100;

export function todaysSendCount(userId: number, motion?: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const conn = getDb();
  const row = motion
    ? (conn
        .prepare(
          `SELECT COUNT(*) AS c FROM outreach
           WHERE user_id = ? AND motion = ? AND status IN ('sent','accepted','replied') AND substr(sent_at, 1, 10) = ?`
        )
        .get(userId, motion, today) as { c: number })
    : (conn
        .prepare(
          `SELECT COUNT(*) AS c FROM outreach
           WHERE user_id = ? AND status IN ('sent','accepted','replied') AND substr(sent_at, 1, 10) = ?`
        )
        .get(userId, today) as { c: number });
  return row.c;
}

// 7-day rolling window send count for INC-028 weekly cap awareness.
export function weeklySendCount(userId: number, motion?: string): number {
  const conn = getDb();
  const row = motion
    ? (conn
        .prepare(
          `SELECT COUNT(*) AS c FROM outreach
           WHERE user_id = ? AND motion = ? AND status IN ('sent','accepted','replied')
             AND sent_at > datetime('now', '-7 days')`
        )
        .get(userId, motion) as { c: number })
    : (conn
        .prepare(
          `SELECT COUNT(*) AS c FROM outreach
           WHERE user_id = ? AND status IN ('sent','accepted','replied')
             AND sent_at > datetime('now', '-7 days')`
        )
        .get(userId) as { c: number });
  return row.c;
}

export async function approveAndSend(
  userId: number,
  outreachId: number,
  opts?: { overrideSoftCap?: boolean }
): Promise<{ ok: boolean; error?: string; throttle?: { dailyCount: number; cap: number } }> {
  const conn = getDb();
  const row = conn
    .prepare(
      `SELECT o.id, o.motion, o.draft_body, o.draft_subject, o.status, p.linkedin_url, p.full_name
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.user_id = ? AND o.id = ?`
    )
    .get(userId, outreachId) as
    | { id: number; motion: string; draft_body: string; draft_subject: string | null; status: string; linkedin_url: string; full_name: string }
    | undefined;
  if (!row) return { ok: false, error: 'outreach not found' };
  if (row.status !== 'draft') return { ok: false, error: `cannot send from status=${row.status}` };

  // INC-028 throttle — daily AND 7-day rolling window. Weekly hard cap is the
  // one LinkedIn actually enforces (~100/7d), so it takes priority over the
  // daily soft cap.
  if (row.motion === 'connection_request') {
    const weeklyCount = weeklySendCount(userId, 'connection_request');
    if (weeklyCount >= INC_028_WEEKLY_HARD_CAP) {
      return {
        ok: false,
        error: `INC-028 weekly hard cap: ${weeklyCount} sent in the last 7 days (cap ${INC_028_WEEKLY_HARD_CAP}). Wait for the rolling window to age out.`,
        throttle: { dailyCount: weeklyCount, cap: INC_028_WEEKLY_HARD_CAP }
      };
    }
    if (weeklyCount >= INC_028_WEEKLY_SOFT_CAP && !opts?.overrideSoftCap) {
      return {
        ok: false,
        error: `INC-028 weekly soft cap: ${weeklyCount} sent in the last 7 days (recommended ≤${INC_028_WEEKLY_SOFT_CAP}, hard ${INC_028_WEEKLY_HARD_CAP}). Pass overrideSoftCap to proceed.`,
        throttle: { dailyCount: weeklyCount, cap: INC_028_WEEKLY_SOFT_CAP }
      };
    }
    // Gate 7 freshness — Rung 3/4 evidence must be <24h old before sending.
    // Per v7 BDR skill: "Refresh Rung 3 within 24h of every send" (locked Apr 30).
    // Rationale: live LinkedIn data drifts; sending with stale evidence risks the
    // INC-026 wrong-title pattern.
    const evidenceRow = conn
      .prepare(
        `SELECT e.captured_at FROM outreach o
         LEFT JOIN evidence e ON e.id = o.evidence_id
         WHERE o.id = ? AND o.user_id = ?`
      )
      .get(outreachId, userId) as { captured_at: string | null } | undefined;
    const capturedAt = evidenceRow?.captured_at;
    const hoursSinceCapture = capturedAt
      ? (Date.now() - new Date(capturedAt).getTime()) / 3_600_000
      : null;
    if (hoursSinceCapture !== null && hoursSinceCapture > 24 && !opts?.overrideSoftCap) {
      return {
        ok: false,
        error: `Gate 7 freshness: evidence captured ${hoursSinceCapture.toFixed(1)}h ago (>24h). Re-run the pipeline to refresh, or pass overrideSoftCap to bypass (not recommended — INC-026 risk).`
      };
    }

    // Phase 9.0.5 — INC-028 rate-limit cooldown check. If a recent
    // controlProfileCheck failed, app_state has a cooldown timer. Block sends
    // until it expires.
    const cooldownRow = conn
      .prepare("SELECT value FROM app_state WHERE key = 'inc028_cooldown_until'")
      .get() as { value: string } | undefined;
    if (cooldownRow?.value) {
      const cooldownUntil = new Date(cooldownRow.value).getTime();
      if (cooldownUntil > Date.now()) {
        const hoursLeft = ((cooldownUntil - Date.now()) / 3_600_000).toFixed(1);
        return {
          ok: false,
          error: `INC-028 cooldown active: rate-limit detected at last control-profile probe. ${hoursLeft}h remaining. Set Settings → clear cooldown or wait.`
        };
      }
    }

    // Pre-resume control-profile check. Run if no successful send in last 24h
    // OR override is explicitly set. Detects INC-028 weekly-cap soft-blocks
    // before the user wastes attempts on real prospects.
    const lastSendRow = conn
      .prepare(
        `SELECT sent_at FROM outreach
         WHERE user_id = ? AND motion = 'connection_request' AND status IN ('sent','accepted','replied')
         ORDER BY sent_at DESC LIMIT 1`
      )
      .get(userId) as { sent_at: string | null } | undefined;
    const lastSentAt = lastSendRow?.sent_at;
    const hoursSinceLast = lastSentAt
      ? (Date.now() - new Date(lastSentAt).getTime()) / 3_600_000
      : Infinity;
    if (hoursSinceLast >= 24) {
      // Sample the next 3 draft prospects from our queue + the current one as
      // the 4th probe — per v7 Phase 9.0 4-profile sampling.
      const sampleRows = conn
        .prepare(
          `SELECT p.linkedin_url FROM outreach o JOIN prospects p ON p.id = o.prospect_id
           WHERE o.user_id = ? AND o.status = 'draft' AND o.id != ?
           ORDER BY o.drafted_at DESC LIMIT 3`
        )
        .all(userId, outreachId) as Array<{ linkedin_url: string }>;
      const sampleUrls = [row.linkedin_url, ...sampleRows.map((r) => r.linkedin_url)].slice(0, 4);
      log.info(`pre-resume control check (${hoursSinceLast.toFixed(1)}h since last send, ${sampleUrls.length}-profile sample)`);
      const control = await controlProfileCheck(userId, sampleUrls);
      if (control.ok && !control.connectButtonVisible) {
        // v7 Phase 9.0.5: confirmed rate-limit → set cooldown for 7d (rolling window).
        // The user can manually clear it from Settings if they're confident the
        // probe was a false positive.
        const cooldownUntil = new Date(Date.now() + 7 * 24 * 3_600_000).toISOString();
        conn
          .prepare(
            `INSERT INTO app_state (key, value, meta) VALUES ('inc028_cooldown_until', ?, ?)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value, meta = excluded.meta, updated_at = datetime('now')`
          )
          .run(cooldownUntil, JSON.stringify({ reason: 'control-profile probe failed', detected_at: new Date().toISOString() }));
        log.warn(`INC-028 cooldown set until ${cooldownUntil}`);
        return {
          ok: false,
          error: control.error ?? 'Connect button missing on control profile — INC-028 soft-block detected. 7-day cooldown active.'
        };
      }
      if (!control.ok && control.error) {
        log.warn('control check inconclusive, continuing:', control.error);
      }
    }

    const dailyCount = todaysSendCount(userId, 'connection_request');
    if (dailyCount >= INC_028_HARD_CAP) {
      return {
        ok: false,
        error: `INC-028 daily hard cap: ${dailyCount} connection requests today (cap ${INC_028_HARD_CAP}). Stop sending until tomorrow.`,
        throttle: { dailyCount, cap: INC_028_HARD_CAP }
      };
    }
    if (dailyCount >= INC_028_SOFT_CAP && !opts?.overrideSoftCap) {
      return {
        ok: false,
        error: `INC-028 daily soft cap: ${dailyCount} sent today (recommended ≤${INC_028_SOFT_CAP}). Pass overrideSoftCap to proceed.`,
        throttle: { dailyCount, cap: INC_028_SOFT_CAP }
      };
    }
  }

  let result;
  try {
    result =
      row.motion === 'sales_nav_inmail'
        ? await withWatchdog('inmail-send', WATCHDOG.INMAIL_SEND_MS, () =>
            sendSalesNavInMail({
              userId,
              profileUrl: row.linkedin_url,
              approvedSubject: row.draft_subject ?? '',
              approvedBody: row.draft_body
            })
          )
        : await withWatchdog('connect-send', WATCHDOG.CONNECT_SEND_MS, () =>
            sendConnectionRequest({
              userId,
              profileUrl: row.linkedin_url,
              approvedMessage: row.draft_body,
              expectedFullName: row.full_name,
              dryRun: false
            })
          );
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    // Watchdog timeouts are usually transient (LinkedIn slow load, Sales Nav lag)
    // → enqueue for backoff retry instead of marking permanently failed.
    if (err instanceof WatchdogTimeout) {
      const queueId = enqueueSend(userId, outreachId, reason);
      return { ok: false, error: `${reason} — queued for retry (queue id ${queueId})` };
    }
    conn
      .prepare(`UPDATE outreach SET status='failed', status_reason=? WHERE id=?`)
      .run(`watchdog: ${reason}`, outreachId);
    return { ok: false, error: reason };
  }

  if (!result.ok) {
    conn
      .prepare(`UPDATE outreach SET status='failed', status_reason=? WHERE id=?`)
      .run(`${result.step}: ${result.reason ?? ''}`, outreachId);
    return { ok: false, error: result.reason ?? result.step };
  }
  conn
    .prepare(`UPDATE outreach SET status='sent', sent_at=datetime('now') WHERE id=?`)
    .run(outreachId);
  return { ok: true };
}
