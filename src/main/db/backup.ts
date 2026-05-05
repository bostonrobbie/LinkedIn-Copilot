// SQLite backup/restore. Uses better-sqlite3's `db.backup()` API for online
// backup (safe with WAL + concurrent writes). Restore swaps the live file
// after closing the connection; the next getDb() call reopens.

import { app } from 'electron';
import { existsSync, mkdirSync, readdirSync, statSync, copyFileSync, unlinkSync } from 'node:fs';
import { join, basename } from 'node:path';
import log from 'electron-log';
import { closeDb, getDb, getDbPath } from './client';

export interface BackupEntry {
  name: string;
  path: string;
  size: number;
  createdAt: string;
}

function backupDir(): string {
  const dir = join(app.getPath('userData'), 'backups');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  return dir;
}

export async function createBackup(label?: string): Promise<BackupEntry> {
  const dir = backupDir();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').slice(0, 19);
  const suffix = label ? `-${label.replace(/[^a-z0-9_-]/gi, '')}` : '';
  const target = join(dir, `app-${stamp}${suffix}.sqlite`);

  // Online backup — better-sqlite3 returns a promise.
  const conn = getDb();
  // Reify the WAL into the main file before copying so the snapshot is consistent.
  conn.pragma('wal_checkpoint(TRUNCATE)');
  await conn.backup(target);
  const size = statSync(target).size;

  // Integrity check on the snapshot — open it as its own DB and run PRAGMA integrity_check.
  // We import the library dynamically since this is the same process.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const Database = require('better-sqlite3') as typeof import('better-sqlite3');
  let integrity = 'unknown';
  try {
    const verify = new Database(target, { readonly: true });
    const row = verify.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    integrity = row?.integrity_check ?? 'unknown';
    verify.close();
  } catch (err) {
    log.warn('backup integrity_check failed', err);
    integrity = 'error';
  }
  if (integrity !== 'ok') {
    log.error(`backup ${target} integrity_check returned ${integrity}`);
    throw new Error(`backup integrity check failed: ${integrity}`);
  }

  log.info(`backup created at ${target} (${(size / 1024).toFixed(1)} KB, integrity ok)`);
  pruneOldBackups(20);
  return { name: basename(target), path: target, size, createdAt: stamp };
}

let autoBackupTimer: NodeJS.Timeout | null = null;

export function startAutoBackup(intervalHours = 24): void {
  if (autoBackupTimer) return;
  const tick = async () => {
    try {
      const e = await createBackup('auto');
      log.info(`auto-backup created: ${e.name}`);
    } catch (err) {
      log.warn('auto-backup failed', err);
    }
  };
  // First auto-backup 5 minutes after launch (so onboarding has data to snapshot),
  // then every intervalHours.
  setTimeout(tick, 5 * 60_000);
  autoBackupTimer = setInterval(tick, intervalHours * 60 * 60_000);
  log.info(`auto-backup scheduler started (every ${intervalHours}h)`);
}

export function stopAutoBackup(): void {
  if (autoBackupTimer) {
    clearInterval(autoBackupTimer);
    autoBackupTimer = null;
  }
}

export function listBackups(): BackupEntry[] {
  const dir = backupDir();
  if (!existsSync(dir)) return [];
  const files = readdirSync(dir).filter((f) => f.endsWith('.sqlite'));
  const entries = files.map((f) => {
    const path = join(dir, f);
    const stat = statSync(path);
    return {
      name: f,
      path,
      size: stat.size,
      createdAt: stat.mtime.toISOString()
    };
  });
  entries.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return entries;
}

function pruneOldBackups(keep: number): void {
  const entries = listBackups();
  for (const e of entries.slice(keep)) {
    try {
      unlinkSync(e.path);
      log.info(`pruned old backup ${e.name}`);
    } catch (err) {
      log.warn(`failed to prune ${e.name}`, err);
    }
  }
}

export async function restoreBackup(name: string): Promise<{ ok: boolean; error?: string; preRestoreBackup?: string }> {
  const dir = backupDir();
  const source = join(dir, name);
  if (!existsSync(source)) return { ok: false, error: 'backup not found' };
  const target = getDbPath();

  // Take a "pre-restore" snapshot first so a bad backup doesn't lose current data.
  let preRestoreName: string | undefined;
  try {
    const pre = await createBackup('pre-restore');
    preRestoreName = pre.name;
  } catch (err) {
    log.warn('pre-restore snapshot failed; continuing anyway', err);
  }

  try {
    closeDb();
    for (const ext of ['', '-wal', '-shm']) {
      const f = target + ext;
      if (existsSync(f)) try { unlinkSync(f); } catch { /* best-effort */ }
    }
    copyFileSync(source, target);
    log.info(`restored ${name} → ${target} (pre-restore=${preRestoreName ?? 'n/a'})`);
    return { ok: true, preRestoreBackup: preRestoreName };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), preRestoreBackup: preRestoreName };
  }
}

export function deleteBackup(name: string): { ok: boolean; error?: string } {
  const dir = backupDir();
  const path = join(dir, name);
  if (!existsSync(path)) return { ok: false, error: 'backup not found' };
  try {
    unlinkSync(path);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}
