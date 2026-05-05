// Reply sync worker. Diffs LinkedIn truth (invitations + messages) against the
// local outreach table. Marks rows as accepted/replied/declined when LinkedIn
// reports state changes. Designed to be safe to run on a schedule (idempotent).

import log from 'electron-log';
import { getDb } from '../db/client';
import { newPage } from '../browser/session';
import { classifyAndPersist } from './replyClassifier';
import type { SyncResult } from '@shared/types';

interface OutstandingRow {
  id: number;
  prospect_id: number;
  full_name: string;
  linkedin_slug: string | null;
  motion: string;
  status: string;
}

function loadOutstanding(userId: number): OutstandingRow[] {
  return getDb()
    .prepare(
      `SELECT o.id, o.prospect_id, p.full_name, p.linkedin_slug, o.motion, o.status
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.user_id = ? AND o.status IN ('sent','accepted')`
    )
    .all(userId) as OutstandingRow[];
}

function markAccepted(outreachId: number): void {
  getDb()
    .prepare(`UPDATE outreach SET status='accepted', accepted_at=datetime('now') WHERE id=? AND status='sent'`)
    .run(outreachId);
}

function markReplied(outreachId: number, body: string): void {
  getDb()
    .prepare(
      `UPDATE outreach SET status='replied', replied_at=datetime('now'), reply_body=?
       WHERE id=? AND status IN ('sent','accepted')`
    )
    .run(body, outreachId);
}

// Scan the "Manage invitations" page for accepts. LinkedIn shows sent invitations
// at /mynetwork/invitation-manager/sent/. Disappearance from the sent list
// (combined with no decline notice) implies acceptance.
async function scanAccepts(userId: number): Promise<{ acceptedSlugs: Set<string>; scanned: number }> {
  const page = await newPage(userId);
  await page.goto('https://www.linkedin.com/mynetwork/invitation-manager/sent/', {
    waitUntil: 'domcontentloaded',
    timeout: 30_000
  });
  await page.waitForTimeout(2_000);

  // Pull the still-pending sent invitations: anchors with /in/<slug>.
  const stillPendingSlugs = new Set<string>();
  const links = await page.locator('main a[href*="/in/"]').all().catch(() => []);
  for (const a of links) {
    const href = await a.getAttribute('href').catch(() => null);
    if (!href) continue;
    const m = href.match(/\/in\/([^/?#]+)/);
    if (m) stillPendingSlugs.add(decodeURIComponent(m[1]));
  }
  return { acceptedSlugs: new Set(), scanned: stillPendingSlugs.size, ...{ stillPendingSlugs } } as unknown as {
    acceptedSlugs: Set<string>;
    scanned: number;
  };
}

// Scan the messaging inbox for new replies on threads we know about.
async function scanReplies(userId: number, slugs: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (slugs.length === 0) return out;
  const page = await newPage(userId);
  await page.goto('https://www.linkedin.com/messaging/', { waitUntil: 'domcontentloaded', timeout: 30_000 });
  await page.waitForTimeout(2_000);

  // Heuristic: read visible conversation snippets, match by full name.
  // (Day-2 lite: no per-thread deep navigation. We rely on the unread badge + snippet.)
  const items = await page.locator('li.msg-conversation-listitem').all().catch(() => []);
  for (const li of items.slice(0, 25)) {
    const isUnread = await li
      .locator('.msg-conversation-card__unread-count, [data-test-icon="msg-icon"]')
      .count()
      .catch(() => 0);
    if (!isUnread) continue;
    const name = (await li
      .locator('.msg-conversation-listitem__participant-names')
      .textContent({ timeout: 1500 })
      .catch(() => null))?.trim();
    const snippet = (await li
      .locator('.msg-conversation-card__message-snippet')
      .textContent({ timeout: 1500 })
      .catch(() => null))?.trim();
    if (!name) continue;
    // Best-effort match on slug-derived name.
    for (const slug of slugs) {
      const slugName = slug.replace(/-\w+$/, '').replace(/-/g, ' ');
      if (name.toLowerCase().includes(slugName.toLowerCase())) {
        out.set(slug, snippet ?? '(unread reply)');
      }
    }
  }
  return out;
}

export async function runReplySync(userId: number): Promise<SyncResult> {
  try {
    const outstanding = loadOutstanding(userId);
    if (outstanding.length === 0) {
      return { ok: true, newAccepts: 0, newReplies: 0, scanned: 0 };
    }

    // 1) Accept detection — anything we previously sent that's no longer in the
    //    "sent invitations" list is presumed accepted (this is LinkedIn's UX).
    const sentRows = outstanding.filter((r) => r.motion === 'connection_request' && r.status === 'sent');
    const sentSlugs = sentRows.map((r) => r.linkedin_slug).filter((s): s is string => !!s);

    let acceptCount = 0;
    if (sentSlugs.length > 0) {
      const { stillPendingSlugs } = (await scanAccepts(userId)) as unknown as { stillPendingSlugs: Set<string> };
      for (const r of sentRows) {
        if (r.linkedin_slug && !stillPendingSlugs.has(r.linkedin_slug)) {
          markAccepted(r.id);
          acceptCount++;
        }
      }
    }

    // 2) Reply detection — for accepted rows, scan the messaging inbox.
    const acceptedRows = outstanding
      .filter((r) => r.status === 'accepted' || sentRows.some((s) => s.id === r.id))
      .map((r) => r.linkedin_slug)
      .filter((s): s is string => !!s);
    const replies = await scanReplies(userId, acceptedRows);
    let replyCount = 0;
    const newlyReplied: number[] = [];
    for (const r of outstanding) {
      if (r.linkedin_slug && replies.has(r.linkedin_slug)) {
        markReplied(r.id, replies.get(r.linkedin_slug) ?? '');
        replyCount++;
        newlyReplied.push(r.id);
      }
    }

    // Run reply classifier on newly-replied rows. Hostile replies trigger auto-DNC.
    for (const outreachId of newlyReplied) {
      try {
        await classifyAndPersist(userId, outreachId);
      } catch (err) {
        log.warn(`classifyAndPersist failed for outreach ${outreachId}`, err);
      }
    }

    return { ok: true, newAccepts: acceptCount, newReplies: replyCount, scanned: outstanding.length };
  } catch (err) {
    log.error('reply sync failed', err);
    return { ok: false, newAccepts: 0, newReplies: 0, scanned: 0, error: err instanceof Error ? err.message : String(err) };
  }
}

// Register a periodic background sync. Runs every N minutes while the app is open.
let timer: NodeJS.Timeout | null = null;
export function startBackgroundSync(userId: number, intervalMinutes = 15): void {
  if (timer) return;
  const tick = async () => {
    try {
      const r = await runReplySync(userId);
      log.info('background sync', r);
    } catch (err) {
      log.warn('background sync error', err);
    }
  };
  // First run after 60s so we don't fire during app startup.
  setTimeout(tick, 60_000);
  timer = setInterval(tick, intervalMinutes * 60_000);
}

export function stopBackgroundSync(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}
