// Versioned schema migration runner. Each migration is a .sql file in
// src/main/db/migrations/ named NNN_*.sql where NNN is the target version.
// SQLite's PRAGMA user_version persists the current applied version so we
// only run forward.
//
// To add a migration: create migrations/00N_xxx.sql with idempotent SQL
// (CREATE TABLE IF NOT EXISTS, etc.). Bump SCHEMA_VERSION to N. Ship.

import type Database from 'better-sqlite3';
import log from 'electron-log';
import migration001 from './migrations/001_initial.sql?raw';
import migration002 from './migrations/002_encrypted_keys.sql?raw';
import migration003 from './migrations/003_send_queue.sql?raw';
import migration004 from './migrations/004_onboarding.sql?raw';
import migration005 from './migrations/005_mvp_completion.sql?raw';
import migration006 from './migrations/006_classification_overrides.sql?raw';
import migration007 from './migrations/007_app_state.sql?raw';

interface Migration {
  version: number;
  name: string;
  sql: string;
}

// Add new migrations here. Vite inlines each file as a string at build time
// via the `?raw` import suffix.
const MIGRATIONS: Migration[] = [
  { version: 1, name: 'initial', sql: migration001 },
  { version: 2, name: 'encrypted_keys', sql: migration002 },
  { version: 3, name: 'send_queue', sql: migration003 },
  { version: 4, name: 'onboarding', sql: migration004 },
  { version: 5, name: 'mvp_completion', sql: migration005 },
  { version: 6, name: 'classification_overrides', sql: migration006 },
  { version: 7, name: 'app_state', sql: migration007 }
];

export const SCHEMA_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

export function getCurrentVersion(db: Database.Database): number {
  const row = db.prepare('PRAGMA user_version').get() as { user_version: number };
  return row.user_version ?? 0;
}

export function runMigrations(db: Database.Database): { from: number; to: number; applied: string[] } {
  const from = getCurrentVersion(db);
  const applied: string[] = [];
  const pending = MIGRATIONS.filter((m) => m.version > from).sort((a, b) => a.version - b.version);
  if (pending.length === 0) {
    log.info(`schema up to date at v${from}`);
    return { from, to: from, applied };
  }
  log.info(`applying ${pending.length} migration(s) from v${from}`);
  // Apply each in its own transaction; bump user_version after each.
  for (const m of pending) {
    log.info(`migration ${m.version} (${m.name}): start`);
    const tx = db.transaction(() => {
      db.exec(m.sql);
      db.exec(`PRAGMA user_version = ${m.version}`);
    });
    tx();
    applied.push(`${m.version}_${m.name}`);
    log.info(`migration ${m.version} (${m.name}): applied`);
  }
  return { from, to: getCurrentVersion(db), applied };
}
