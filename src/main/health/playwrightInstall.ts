// Playwright Chromium auto-install. Runs `npx playwright install chromium`
// when the binary is missing. Streams progress via callback.

import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import log from 'electron-log';

export type ProgressCallback = (line: string) => void;

export function isChromiumInstalled(): { ok: boolean; path: string | null; error?: string } {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const playwright = require('playwright');
    const exec = playwright.chromium.executablePath();
    if (exec && existsSync(exec)) return { ok: true, path: exec };
    return { ok: false, path: exec ?? null, error: 'executable not found at resolved path' };
  } catch (err) {
    return { ok: false, path: null, error: err instanceof Error ? err.message : String(err) };
  }
}

export function installChromium(onProgress?: ProgressCallback): Promise<{ ok: boolean; error?: string }> {
  return new Promise((resolve) => {
    log.info('starting playwright chromium install');
    onProgress?.('Starting Playwright Chromium install…');

    const child = spawn('npx', ['playwright', 'install', 'chromium'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env, FORCE_COLOR: '0' }
    });

    const buffer: string[] = [];
    const append = (chunk: Buffer) => {
      const str = chunk.toString('utf8');
      buffer.push(str);
      str.split(/\r?\n/).forEach((line) => {
        const t = line.trim();
        if (t) {
          onProgress?.(t);
          log.info('[playwright-install]', t);
        }
      });
    };
    child.stdout.on('data', append);
    child.stderr.on('data', append);

    child.on('error', (err) => {
      log.error('playwright install spawn error', err);
      resolve({ ok: false, error: err.message });
    });

    child.on('close', (code) => {
      const fullOutput = buffer.join('');
      if (code === 0) {
        onProgress?.('Install complete.');
        resolve({ ok: true });
      } else {
        const tail = fullOutput.split(/\r?\n/).filter(Boolean).slice(-5).join(' | ');
        resolve({ ok: false, error: `exit ${code}: ${tail}` });
      }
    });
  });
}
