import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { parse } from 'csv-parse/sync';
import log from 'electron-log';
import { getDb } from './client';
import type { AccountTier } from '@shared/types';

interface TamRow {
  'Account Name': string;
  'Account Location': string;
  'Linkedin Company URL': string;
  'Website Domain': string;
  'Account Owner': string;
}

interface MasterSentRow {
  name: string;
  batch: string;
  send_date: string;
  channel: string;
  norm: string;
}

interface DncRow {
  name: string;
  company: string;
  reason: string;
  date: string;
}

interface G2Seed {
  accounts: Array<{ name: string; domain: string }>;
}

function findSeed(name: string): string | null {
  const candidates = [
    // dev: project root sibling to src
    resolve(process.cwd(), 'data', 'seed', name),
    // packaged: extraResources copies seed/ next to app
    resolve(process.resourcesPath || '', 'seed', name),
    // fallback: relative to compiled file
    resolve(__dirname, '..', '..', 'data', 'seed', name)
  ];
  return candidates.find(existsSync) ?? null;
}

const FACTOR_DOMAINS = new Set<string>(); // Populated lazily; for MVP all TAM rows are tier=TAM unless a separate Factor list arrives.

export function seedAccounts(userId: number): { inserted: number; total: number } {
  const conn = getDb();
  const tamPath = findSeed('tam.csv');
  if (!tamPath) {
    log.warn('tam.csv not found in any seed location; skipping account seed');
    return { inserted: 0, total: 0 };
  }
  const csv = readFileSync(tamPath, 'utf8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as TamRow[];

  const g2Path = findSeed('g2-accounts.json');
  const g2Domains = new Set<string>();
  if (g2Path) {
    const g2: G2Seed = JSON.parse(readFileSync(g2Path, 'utf8'));
    g2.accounts.forEach((a) => g2Domains.add(a.domain.toLowerCase()));
  }

  const insert = conn.prepare(
    `INSERT OR IGNORE INTO accounts (user_id, name, domain, linkedin_url, location, tier)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  const tx = conn.transaction(() => {
    let inserted = 0;
    for (const r of rows) {
      const domain = (r['Website Domain'] || '').trim().toLowerCase();
      const tier: AccountTier = g2Domains.has(domain)
        ? 'G2'
        : FACTOR_DOMAINS.has(domain)
          ? 'Factor'
          : 'TAM';
      const info = insert.run(
        userId,
        r['Account Name'],
        domain || null,
        r['Linkedin Company URL'] || null,
        r['Account Location'] || null,
        tier
      );
      if (info.changes > 0) inserted++;
    }
    return inserted;
  });

  const inserted = tx();

  // Always-add G2 accounts not already in TAM.
  if (g2Path) {
    const g2: G2Seed = JSON.parse(readFileSync(g2Path, 'utf8'));
    const g2Tx = conn.transaction(() => {
      for (const a of g2.accounts) {
        insert.run(userId, a.name, a.domain.toLowerCase(), null, null, 'G2');
      }
    });
    g2Tx();
  }

  const { count } = conn
    .prepare('SELECT COUNT(*) AS count FROM accounts WHERE user_id = ?')
    .get(userId) as { count: number };

  log.info(`accounts seeded: +${inserted}, total ${count}`);
  return { inserted, total: count };
}

export function seedDnc(userId: number): { inserted: number } {
  const conn = getDb();
  const path = findSeed('dnc.json');
  if (!path) return { inserted: 0 };
  const rows: DncRow[] = JSON.parse(readFileSync(path, 'utf8'));
  const insert = conn.prepare(
    `INSERT OR IGNORE INTO dnc (user_id, name_norm, display_name, company, reason)
     VALUES (?, ?, ?, ?, ?)`
  );
  const tx = conn.transaction(() => {
    let n = 0;
    for (const r of rows) {
      const info = insert.run(userId, r.name.trim().toLowerCase(), r.name.trim(), r.company, r.reason);
      if (info.changes > 0) n++;
    }
    return n;
  });
  // De-dup by name_norm via partial unique enforcement: re-create constraint at app level.
  conn.exec(
    `DELETE FROM dnc WHERE id NOT IN (SELECT MIN(id) FROM dnc GROUP BY user_id, name_norm)`
  );
  const inserted = tx();
  log.info(`dnc seeded: +${inserted}`);
  return { inserted };
}

export function seedPriorContacts(userId: number): { inserted: number } {
  const conn = getDb();
  const path = findSeed('master_sent_list.csv');
  if (!path) return { inserted: 0 };
  const csv = readFileSync(path, 'utf8');
  const rows = parse(csv, { columns: true, skip_empty_lines: true, trim: true }) as MasterSentRow[];
  const insert = conn.prepare(
    `INSERT INTO prior_contacts (user_id, name_norm, display_name, channel, send_date, source)
     VALUES (?, ?, ?, ?, ?, 'master_sent_list_seed')`
  );
  const tx = conn.transaction(() => {
    let n = 0;
    for (const r of rows) {
      if (!r.norm) continue;
      insert.run(userId, r.norm, r.name, r.channel, r.send_date);
      n++;
    }
    return n;
  });
  const inserted = tx();
  log.info(`prior_contacts seeded: +${inserted}`);
  return { inserted };
}

export function seedAll(userId: number): void {
  const c = getDb()
    .prepare('SELECT COUNT(*) AS c FROM accounts WHERE user_id = ?')
    .get(userId) as { c: number };
  if (c.c > 0) {
    log.info('accounts already seeded, skipping');
    return;
  }
  seedAccounts(userId);
  seedDnc(userId);
  seedPriorContacts(userId);
}
