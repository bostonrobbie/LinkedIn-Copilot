// Reads the tail of electron-log's main.log so the in-app Health page can show
// recent activity without forcing the user to dig through the userData folder.

import { existsSync, statSync, readFileSync } from 'node:fs';
import log from 'electron-log';

export interface LogTailEntry {
  ts: string | null;
  level: string | null;
  text: string;
  raw: string;
}

const LINE_RE = /^\[(?<ts>[^\]]+)\]\s*\[(?<level>[^\]]+)\]\s*(?<text>.*)$/;

export function readLogTail(maxLines = 200): { path: string | null; size: number; entries: LogTailEntry[] } {
  // electron-log file path discovery via its own API.
  const path =
    (typeof log.transports.file.getFile === 'function' ? log.transports.file.getFile().path : null) ??
    null;

  if (!path || !existsSync(path)) {
    return { path, size: 0, entries: [] };
  }
  const size = statSync(path).size;
  // Bound read to 256KB tail so very large logs don't blow up the renderer.
  const cap = 256 * 1024;
  const start = Math.max(0, size - cap);
  let raw = '';
  try {
    const buf = readFileSync(path);
    raw = buf.subarray(start).toString('utf8');
    // Drop a partial first line if we cut into the middle.
    if (start > 0) raw = raw.replace(/^[^\n]*\n/, '');
  } catch (e) {
    return { path, size, entries: [{ ts: null, level: 'error', text: 'failed to read log', raw: String(e) }] };
  }

  const lines = raw.split('\n').filter(Boolean);
  const entries: LogTailEntry[] = [];
  for (const line of lines.slice(-maxLines)) {
    const m = line.match(LINE_RE);
    if (m && m.groups) {
      entries.push({ ts: m.groups.ts, level: m.groups.level, text: m.groups.text, raw: line });
    } else {
      entries.push({ ts: null, level: null, text: line, raw: line });
    }
  }
  return { path, size, entries };
}
