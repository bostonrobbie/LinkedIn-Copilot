import Database from 'better-sqlite3';
import { app } from 'electron';
import { existsSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import log from 'electron-log';
import { runMigrations, SCHEMA_VERSION } from './migrate';

let db: Database.Database | null = null;

export function getDbPath(): string {
  const dir = join(app.getPath('userData'), 'db');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return join(dir, 'app.sqlite');
}

export function getDb(): Database.Database {
  if (db) return db;
  const path = getDbPath();
  log.info('opening sqlite at', path);
  db = new Database(path);
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
  return db;
}

export function initSchema(): void {
  const conn = getDb();
  const result = runMigrations(conn);
  if (result.applied.length > 0) {
    log.info(`schema migrations: v${result.from} → v${result.to} (applied ${result.applied.join(', ')})`);
  }
  log.info(`schema at v${result.to} of v${SCHEMA_VERSION}`);
}

export function ensureDefaultUser(): { id: number; email: string; display_name: string } {
  const conn = getDb();
  const existing = conn
    .prepare('SELECT id, email, display_name FROM users ORDER BY id LIMIT 1')
    .get() as { id: number; email: string; display_name: string } | undefined;
  if (existing) return existing;
  const info = conn
    .prepare(
      "INSERT INTO users (email, display_name) VALUES (?, ?)"
    )
    .run('robert.gorham@testsigma.com', 'Rob Gorham');
  return {
    id: Number(info.lastInsertRowid),
    email: 'robert.gorham@testsigma.com',
    display_name: 'Rob Gorham'
  };
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
