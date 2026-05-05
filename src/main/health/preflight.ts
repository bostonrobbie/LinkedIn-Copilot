// Preflight self-test. Runs ~10 cheap checks at startup and on demand.
// Each check returns a structured result; the Health page renders them.

import { app } from 'electron';
import { existsSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import log from 'electron-log';
import { getDb } from '../db/client';
import { getLinkedInState, getSalesNavState } from '../runtime-state';
import { decryptKey, isEncryptionAvailable } from '../secrets';

export type CheckStatus = 'ok' | 'warn' | 'error' | 'info';

export interface CheckResult {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  fixHint?: string;
  meta?: Record<string, unknown>;
}

export interface PreflightReport {
  ts: string;
  overall: CheckStatus;
  checks: CheckResult[];
}

function ok(id: string, label: string, detail: string, meta?: Record<string, unknown>): CheckResult {
  return { id, label, status: 'ok', detail, meta };
}
function warn(id: string, label: string, detail: string, fixHint?: string, meta?: Record<string, unknown>): CheckResult {
  return { id, label, status: 'warn', detail, fixHint, meta };
}
function err(id: string, label: string, detail: string, fixHint?: string, meta?: Record<string, unknown>): CheckResult {
  return { id, label, status: 'error', detail, fixHint, meta };
}
function info(id: string, label: string, detail: string, meta?: Record<string, unknown>): CheckResult {
  return { id, label, status: 'info', detail, meta };
}

function checkSchema(): CheckResult {
  try {
    const conn = getDb();
    const row = conn.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get() as { value: string } | undefined;
    if (!row) return err('schema-version', 'Schema version', 'No schema_meta row found', 'Re-run app to re-init schema');
    return ok('schema-version', 'Schema version', `v${row.value}`, { version: row.value });
  } catch (e) {
    return err('schema-version', 'Schema version', e instanceof Error ? e.message : String(e), 'Schema may not have initialized');
  }
}

function checkDbWritable(): CheckResult {
  try {
    const conn = getDb();
    conn.exec("CREATE TEMP TABLE IF NOT EXISTS _preflight_smoke (k TEXT)");
    conn.prepare("INSERT INTO _preflight_smoke VALUES (?)").run('smoke');
    conn.exec("DROP TABLE _preflight_smoke");
    return ok('db-writable', 'Database writable', 'WAL mode + write/read confirmed');
  } catch (e) {
    return err('db-writable', 'Database writable', e instanceof Error ? e.message : String(e), 'Check disk space and permissions');
  }
}

function checkDbIntegrity(): CheckResult {
  try {
    const conn = getDb();
    const row = conn.prepare('PRAGMA integrity_check').get() as { integrity_check: string };
    if (row?.integrity_check === 'ok') {
      return ok('db-integrity', 'Database integrity', 'integrity_check passed');
    }
    return err('db-integrity', 'Database integrity', row?.integrity_check ?? 'unknown', 'Restore from a backup or wipe userData');
  } catch (e) {
    return err('db-integrity', 'Database integrity', e instanceof Error ? e.message : String(e));
  }
}

function checkSeedCounts(): CheckResult[] {
  const conn = getDb();
  const accounts = (conn.prepare('SELECT COUNT(*) AS c FROM accounts').get() as { c: number }).c;
  const dnc = (conn.prepare('SELECT COUNT(*) AS c FROM dnc').get() as { c: number }).c;
  const prior = (conn.prepare('SELECT COUNT(*) AS c FROM prior_contacts').get() as { c: number }).c;
  const out: CheckResult[] = [];
  out.push(
    accounts >= 100
      ? ok('seed-tam', 'TAM accounts seeded', `${accounts} rows`, { count: accounts })
      : warn('seed-tam', 'TAM accounts seeded', `Only ${accounts} accounts`, 'Settings → Re-import TAM', { count: accounts })
  );
  out.push(
    dnc >= 1
      ? ok('seed-dnc', 'DNC list seeded', `${dnc} entries`, { count: dnc })
      : warn('seed-dnc', 'DNC list seeded', 'No DNC rows', 'Re-run scripts/extract-dnc.mjs', { count: dnc })
  );
  out.push(
    prior >= 1
      ? ok('seed-prior', 'Prior-contact ledger', `${prior} rows`, { count: prior })
      : warn('seed-prior', 'Prior-contact ledger', 'No prior contacts seeded', 'MASTER_SENT_LIST.csv missing or empty', { count: prior })
  );
  return out;
}

function checkAnthropicKey(): CheckResult {
  const conn = getDb();
  const row = conn
    .prepare('SELECT anthropic_api_key, anthropic_api_key_enc FROM users ORDER BY id LIMIT 1')
    .get() as { anthropic_api_key: string | null; anthropic_api_key_enc: Buffer | null } | undefined;
  const plain = row?.anthropic_api_key ?? decryptKey(row?.anthropic_api_key_enc);
  if (plain) {
    const enc = !!row?.anthropic_api_key_enc;
    return ok(
      'anthropic-key',
      'Anthropic API key',
      `configured (…${plain.slice(-4)})${enc ? ' [encrypted]' : ' [plaintext — re-save to encrypt]'}`
    );
  }
  return warn('anthropic-key', 'Anthropic API key', 'not set — running on heuristic fallback', 'Settings → Anthropic API key');
}

function checkApolloKey(): CheckResult {
  const conn = getDb();
  const row = conn
    .prepare('SELECT apollo_api_key, apollo_api_key_enc FROM users ORDER BY id LIMIT 1')
    .get() as { apollo_api_key: string | null; apollo_api_key_enc: Buffer | null } | undefined;
  const plain = row?.apollo_api_key ?? decryptKey(row?.apollo_api_key_enc);
  if (plain) {
    const enc = !!row?.apollo_api_key_enc;
    return ok('apollo-key', 'Apollo API key', `configured (…${plain.slice(-4)})${enc ? ' [encrypted]' : ' [plaintext]'}`);
  }
  return info('apollo-key', 'Apollo API key', 'not set — Phase 3 dedup uses local DB only');
}

function checkEncryption(): CheckResult {
  if (isEncryptionAvailable()) {
    return ok('encryption-available', 'OS keychain encryption', 'safeStorage available — keys encrypted at rest');
  }
  return warn(
    'encryption-available',
    'OS keychain encryption',
    'safeStorage unavailable on this platform — keys fall back to plaintext (PLAIN: prefix)',
    'macOS / Windows have keychain by default; on Linux, install gnome-keyring or kwallet'
  );
}

function checkLinkedInSession(): CheckResult {
  const s = getLinkedInState();
  if (s.state === 'logged-in') {
    return ok('linkedin-session', 'LinkedIn session', `recently observed logged in${s.lastObservedAt ? ` (${s.lastObservedAt})` : ''}`);
  }
  if (s.state === 'logged-out' || s.state === 'error') {
    return err('linkedin-session', 'LinkedIn session', `state=${s.state}`, 'Settings → Open LinkedIn login');
  }
  return info('linkedin-session', 'LinkedIn session', 'not yet observed — open Settings → Open LinkedIn login on first run');
}

function checkSalesNavSession(): CheckResult {
  const s = getSalesNavState();
  if (s.state === 'logged-in') {
    return ok('salesnav-session', 'Sales Nav session', `recently observed logged in${s.lastObservedAt ? ` (${s.lastObservedAt})` : ''}`);
  }
  if (s.state === 'logged-out' || s.state === 'error') {
    return err('salesnav-session', 'Sales Nav session', `state=${s.state}`, 'Settings → Open Sales Nav login (required for InMail)');
  }
  return info('salesnav-session', 'Sales Nav session', 'not yet observed — required for InMail; sign in from Settings');
}

function checkPlaywrightChromium(): CheckResult {
  // Best-effort — Playwright stores browsers in ~/Library/Caches/ms-playwright/ (mac)
  // or %USERPROFILE%\AppData\Local\ms-playwright (Windows). We check by trying
  // to resolve playwright's installed browser path via its package metadata.
  try {
    // Lazy-require to avoid ESM issues. Playwright exports `chromium` with `executablePath()`.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const playwright = require('playwright');
    const exec = playwright.chromium.executablePath();
    if (exec && existsSync(exec)) {
      const size = statSync(exec).size;
      return ok('playwright-chromium', 'Playwright Chromium', `${(size / 1024 / 1024).toFixed(1)} MB`, { path: exec });
    }
    return err('playwright-chromium', 'Playwright Chromium', `executable not found at ${exec ?? '(unresolved)'}`, 'Run: npx playwright install chromium');
  } catch (e) {
    return err('playwright-chromium', 'Playwright Chromium', e instanceof Error ? e.message : String(e), 'Run: npx playwright install chromium');
  }
}

function checkPlaywrightProfileDir(): CheckResult {
  try {
    const dir = resolve(app.getPath('userData'), 'playwright-profile');
    if (existsSync(dir)) {
      return ok('playwright-profile', 'Playwright profile dir', dir);
    }
    return info('playwright-profile', 'Playwright profile dir', 'not yet created — first LinkedIn login will create it');
  } catch (e) {
    return err('playwright-profile', 'Playwright profile dir', e instanceof Error ? e.message : String(e));
  }
}

function checkSendsToday(): CheckResult {
  const conn = getDb();
  const today = new Date().toISOString().slice(0, 10);
  const c = (conn
    .prepare(
      "SELECT COUNT(*) AS c FROM outreach WHERE motion='connection_request' AND status IN ('sent','accepted','replied') AND substr(sent_at, 1, 10) = ?"
    )
    .get(today) as { c: number }).c;
  if (c >= 20) return err('sends-today', 'Sends today', `${c} (INC-028 hard cap reached)`, 'Wait until tomorrow');
  if (c >= 10) return warn('sends-today', 'Sends today', `${c} / 10 (INC-028 soft cap)`, 'Override per-send if you must');
  return ok('sends-today', 'Sends today', `${c} / 10 (INC-028 soft cap)`);
}

function checkRecentDrops(): CheckResult {
  const conn = getDb();
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const c = (conn
    .prepare("SELECT COUNT(*) AS c FROM outreach WHERE status='dropped' AND drafted_at >= ?")
    .get(since) as { c: number }).c;
  if (c >= 10) return warn('drop-rate', '24h drop rate', `${c} drops in 24h — re-source pool may be needed`);
  return info('drop-rate', '24h drop rate', `${c} drops in 24h`);
}

function checkInc028Cooldown(): CheckResult {
  const conn = getDb();
  const row = conn
    .prepare("SELECT value, meta, updated_at FROM app_state WHERE key = 'inc028_cooldown_until'")
    .get() as { value: string; meta: string | null; updated_at: string } | undefined;
  if (!row) return ok('inc028-cooldown', 'INC-028 cooldown', 'no cooldown active');
  const until = new Date(row.value).getTime();
  if (until <= Date.now()) {
    return ok('inc028-cooldown', 'INC-028 cooldown', `expired ${row.value} — sends unblocked`);
  }
  const hoursLeft = ((until - Date.now()) / 3_600_000).toFixed(1);
  let reason = '';
  try {
    const m = row.meta ? (JSON.parse(row.meta) as { reason?: string }) : null;
    if (m?.reason) reason = ` (${m.reason})`;
  } catch { /* ignore */ }
  return err(
    'inc028-cooldown',
    'INC-028 cooldown',
    `active until ${row.value}, ${hoursLeft}h left${reason}`,
    'Settings → Advanced → Clear cooldown if you\'re confident the probe was a false positive'
  );
}

export function runPreflight(): PreflightReport {
  const checks: CheckResult[] = [];
  const safe = (fn: () => CheckResult | CheckResult[]) => {
    try {
      const r = fn();
      if (Array.isArray(r)) checks.push(...r);
      else checks.push(r);
    } catch (e) {
      checks.push(err('preflight-error', 'Preflight error', e instanceof Error ? e.message : String(e)));
    }
  };
  safe(checkSchema);
  safe(checkDbWritable);
  safe(checkDbIntegrity);
  safe(checkSeedCounts);
  safe(checkPlaywrightChromium);
  safe(checkPlaywrightProfileDir);
  safe(checkLinkedInSession);
  safe(checkSalesNavSession);
  safe(checkAnthropicKey);
  safe(checkApolloKey);
  safe(checkEncryption);
  safe(checkSendsToday);
  safe(checkRecentDrops);
  safe(checkInc028Cooldown);

  const overall: CheckStatus = checks.some((c) => c.status === 'error')
    ? 'error'
    : checks.some((c) => c.status === 'warn')
      ? 'warn'
      : 'ok';

  log.info(`preflight ${overall}: ${checks.length} checks (${checks.filter((c) => c.status === 'ok').length} ok / ${checks.filter((c) => c.status === 'warn').length} warn / ${checks.filter((c) => c.status === 'error').length} error)`);
  return { ts: new Date().toISOString(), overall, checks };
}
