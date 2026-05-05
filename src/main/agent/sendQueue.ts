// Persistent retry queue. approveAndSend enqueues on transient failure
// (Playwright watchdog timeout, LinkedIn glitch). The worker scans every
// minute and retries with exponential backoff: 1m, 5m, 15m, 60m, 240m.
//
// Sends survive app crash because the queue persists in SQLite.

import log from 'electron-log';
import { getDb } from '../db/client';
import { sendConnectionRequest, sendSalesNavInMail } from '../browser/linkedin';
import { withWatchdog, WATCHDOG } from '../browser/watchdog';

const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

// INC-030 stop-loss: InMail failures with the "credit-charged-no-thread" signature
// (LinkedIn-side block) burn an InMail credit per retry. Cap retries hard at 1 for
// these and auto-DNC the candidate to prevent further burns.
//
// Detection heuristic: result.step indicates a successful send-button click but
// no thread shows up afterward, OR the watchdog tripped on a Sales Nav send AFTER
// the modal opened. We don't have a perfect signal yet; we approximate with
// "InMail send failed AND we got past the body-readback step".
function looksLikeInc030Burn(motion: string, lastError: string | null): boolean {
  if (motion !== 'sales_nav_inmail') return false;
  if (!lastError) return false;
  return /credit|burned|inmail.*block|no thread|body-readback|send.*timeout/i.test(lastError);
}

const INC_030_MAX_RETRIES = 1;

export interface QueueRow {
  id: number;
  outreach_id: number;
  user_id: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  next_attempt_at: string;
  status: 'queued' | 'running' | 'exhausted' | 'done' | 'cancelled';
}

export function enqueueSend(userId: number, outreachId: number, lastError: string): number {
  const conn = getDb();
  const existing = conn
    .prepare('SELECT id FROM send_queue WHERE outreach_id = ? AND status IN (?, ?)')
    .get(outreachId, 'queued', 'running') as { id: number } | undefined;
  if (existing) {
    log.info(`send_queue: outreach ${outreachId} already queued (id=${existing.id})`);
    return existing.id;
  }
  const info = conn
    .prepare(
      `INSERT INTO send_queue (outreach_id, user_id, last_error, next_attempt_at)
       VALUES (?, ?, ?, datetime('now', '+1 minutes'))`
    )
    .run(outreachId, userId, lastError);
  log.info(`send_queue: enqueued outreach ${outreachId} (queue_id=${info.lastInsertRowid})`);
  return Number(info.lastInsertRowid);
}

export function listQueue(userId: number): QueueRow[] {
  return getDb()
    .prepare(
      `SELECT q.id, q.outreach_id, q.user_id, q.attempts, q.max_attempts, q.last_error, q.next_attempt_at, q.status,
              p.full_name, p.company_name, o.motion
       FROM send_queue q
       JOIN outreach o ON o.id = q.outreach_id
       JOIN prospects p ON p.id = o.prospect_id
       WHERE q.user_id = ? ORDER BY q.next_attempt_at ASC`
    )
    .all(userId) as QueueRow[];
}

// Force-retry a queued row immediately (bypassing the next_attempt_at backoff).
export function retryNow(userId: number, queueId: number): { ok: boolean; error?: string } {
  const conn = getDb();
  const row = conn
    .prepare(`SELECT id, status FROM send_queue WHERE id = ? AND user_id = ?`)
    .get(queueId, userId) as { id: number; status: string } | undefined;
  if (!row) return { ok: false, error: 'queue row not found' };
  if (row.status === 'done' || row.status === 'cancelled') {
    return { ok: false, error: `cannot retry status=${row.status}` };
  }
  conn
    .prepare(`UPDATE send_queue SET status='queued', next_attempt_at=datetime('now'), updated_at=datetime('now') WHERE id=?`)
    .run(queueId);
  return { ok: true };
}

// Re-enqueue a permanently-failed outreach (returns to send_queue for the
// worker to pick up). Used by the OutreachDetail "Retry send" button.
export function requeueOutreach(userId: number, outreachId: number): { ok: boolean; queueId?: number; error?: string } {
  const conn = getDb();
  const row = conn
    .prepare(`SELECT id, status FROM outreach WHERE id = ? AND user_id = ?`)
    .get(outreachId, userId) as { id: number; status: string } | undefined;
  if (!row) return { ok: false, error: 'outreach not found' };
  if (row.status !== 'failed' && row.status !== 'draft') {
    return { ok: false, error: `cannot requeue from status=${row.status}` };
  }
  // Reset outreach back to draft so the worker treats it as eligible.
  conn
    .prepare(`UPDATE outreach SET status='draft', status_reason=NULL WHERE id=?`)
    .run(outreachId);
  const queueId = enqueueSend(userId, outreachId, 'manual requeue from UI');
  return { ok: true, queueId };
}

export function cancelQueueRow(userId: number, queueId: number): { ok: boolean } {
  const info = getDb()
    .prepare("UPDATE send_queue SET status='cancelled', updated_at=datetime('now') WHERE id=? AND user_id=?")
    .run(queueId, userId);
  return { ok: info.changes === 1 };
}

async function processOne(row: QueueRow): Promise<void> {
  const conn = getDb();
  conn
    .prepare("UPDATE send_queue SET status='running', attempts=attempts+1, updated_at=datetime('now') WHERE id=?")
    .run(row.id);

  const outreach = conn
    .prepare(
      `SELECT o.id, o.motion, o.draft_body, o.draft_subject, o.status, p.linkedin_url, p.full_name
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.id = ?`
    )
    .get(row.outreach_id) as
    | { id: number; motion: string; draft_body: string; draft_subject: string | null; status: string; linkedin_url: string; full_name: string }
    | undefined;

  if (!outreach) {
    conn.prepare("UPDATE send_queue SET status='cancelled', last_error='outreach row missing' WHERE id=?").run(row.id);
    return;
  }
  if (outreach.status !== 'draft') {
    // Someone else already handled it. Mark done.
    conn.prepare("UPDATE send_queue SET status='done', updated_at=datetime('now') WHERE id=?").run(row.id);
    return;
  }

  let result;
  try {
    result =
      outreach.motion === 'sales_nav_inmail'
        ? await withWatchdog('queue-inmail', WATCHDOG.INMAIL_SEND_MS, () =>
            sendSalesNavInMail({
              userId: row.user_id,
              profileUrl: outreach.linkedin_url,
              approvedSubject: outreach.draft_subject ?? '',
              approvedBody: outreach.draft_body
            })
          )
        : await withWatchdog('queue-connect', WATCHDOG.CONNECT_SEND_MS, () =>
            sendConnectionRequest({
              userId: row.user_id,
              profileUrl: outreach.linkedin_url,
              approvedMessage: outreach.draft_body,
              expectedFullName: outreach.full_name,
              dryRun: false
            })
          );
  } catch (err) {
    result = { ok: false, step: 'watchdog', reason: err instanceof Error ? err.message : String(err) };
  }

  if (result.ok) {
    conn.prepare(`UPDATE outreach SET status='sent', sent_at=datetime('now') WHERE id=?`).run(outreach.id);
    conn.prepare("UPDATE send_queue SET status='done', updated_at=datetime('now') WHERE id=?").run(row.id);
    log.info(`send_queue: outreach ${outreach.id} succeeded after ${row.attempts + 1} attempt(s)`);
    return;
  }

  // Failed again — schedule next retry or exhaust.
  const reason = `${result.step}: ${result.reason ?? ''}`;

  // INC-030 hard cap. If this looks like a credit-burn pattern AND we've already
  // retried once, stop here, mark exhausted, and auto-DNC the candidate.
  const inc030 = looksLikeInc030Burn(outreach.motion, reason);
  const effectiveMax = inc030 ? INC_030_MAX_RETRIES + 1 : row.max_attempts;

  if (row.attempts + 1 >= effectiveMax) {
    const exhaustReason = inc030 ? `INC-030 stop-loss: ${reason}` : `retry exhausted: ${reason}`;
    conn
      .prepare("UPDATE send_queue SET status='exhausted', last_error=?, updated_at=datetime('now') WHERE id=?")
      .run(exhaustReason, row.id);
    conn.prepare(`UPDATE outreach SET status='failed', status_reason=? WHERE id=?`).run(exhaustReason, outreach.id);

    // Auto-DNC for INC-030 burns to prevent any future re-attempt against this profile.
    if (inc030) {
      const prospect = conn
        .prepare('SELECT full_name, company_name FROM prospects WHERE id = (SELECT prospect_id FROM outreach WHERE id = ?)')
        .get(outreach.id) as { full_name: string; company_name: string | null } | undefined;
      if (prospect) {
        try {
          conn
            .prepare(
              `INSERT OR IGNORE INTO dnc (user_id, name_norm, display_name, company, reason, auto_added_from_outreach_id, auto_added_reason_kind)
               VALUES (?, ?, ?, ?, ?, ?, 'inc_030_burn')`
            )
            .run(
              row.user_id,
              prospect.full_name.trim().toLowerCase(),
              prospect.full_name,
              prospect.company_name,
              `INC-030 — LinkedIn-side InMail block (${row.attempts + 1} credits lost)`,
              outreach.id
            );
          log.warn(`auto-DNC added: ${prospect.full_name} (INC-030 burn, outreach ${outreach.id})`);
        } catch (err) {
          log.warn('auto-DNC insert failed', err);
        }
      }
    }

    log.warn(`send_queue: outreach ${outreach.id} exhausted after ${row.attempts + 1} attempts (${inc030 ? 'INC-030 stop-loss' : 'normal'})`);
    return;
  }
  const nextMinutes = BACKOFF_MINUTES[Math.min(row.attempts, BACKOFF_MINUTES.length - 1)];
  conn
    .prepare(
      `UPDATE send_queue
       SET status='queued', last_error=?, next_attempt_at=datetime('now', '+' || ? || ' minutes'),
           updated_at=datetime('now')
       WHERE id=?`
    )
    .run(reason, nextMinutes, row.id);
  log.info(`send_queue: outreach ${outreach.id} retry ${row.attempts + 1} failed (${reason}); next in ${nextMinutes}m`);
}

let timer: NodeJS.Timeout | null = null;

export function startSendQueueWorker(intervalMinutes = 1): void {
  if (timer) return;
  const tick = async () => {
    try {
      const due = getDb()
        .prepare(
          `SELECT id, outreach_id, user_id, attempts, max_attempts, last_error, next_attempt_at, status
           FROM send_queue
           WHERE status = 'queued' AND next_attempt_at <= datetime('now')
           ORDER BY next_attempt_at ASC LIMIT 5`
        )
        .all() as QueueRow[];
      for (const row of due) {
        await processOne(row);
      }
    } catch (err) {
      log.warn('send_queue worker tick failed', err);
    }
  };
  setTimeout(tick, 30_000); // first tick after 30s
  timer = setInterval(tick, intervalMinutes * 60_000);
  log.info(`send_queue worker started (interval ${intervalMinutes}m)`);
}

export function stopSendQueueWorker(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
