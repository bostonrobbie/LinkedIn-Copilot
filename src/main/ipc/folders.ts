// Folder helpers — exposes the userData / log / backup paths and provides
// "open in OS file explorer" behavior.

import { app, shell } from 'electron';
import { join } from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';
import log from 'electron-log';

export function getDataFolders() {
  const userData = app.getPath('userData');
  const backups = join(userData, 'backups');
  const profile = join(userData, 'playwright-profile');
  const logs = (typeof log.transports.file.getFile === 'function' ? log.transports.file.getFile().path : null) ?? '';
  const logsDir = logs ? logs.replace(/[\\/][^\\/]+$/, '') : userData;
  return { userData, backups, profile, logs, logsDir };
}

export async function openFolder(kind: 'userData' | 'backups' | 'profile' | 'logs'): Promise<{ ok: boolean; path: string; error?: string }> {
  const folders = getDataFolders();
  let target = folders.userData;
  if (kind === 'backups') target = folders.backups;
  if (kind === 'profile') target = folders.profile;
  if (kind === 'logs') target = folders.logsDir;
  if (!existsSync(target)) {
    try { mkdirSync(target, { recursive: true }); } catch { /* ignore */ }
  }
  try {
    await shell.openPath(target);
    return { ok: true, path: target };
  } catch (err) {
    return { ok: false, path: target, error: err instanceof Error ? err.message : String(err) };
  }
}
