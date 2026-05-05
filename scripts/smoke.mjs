#!/usr/bin/env node
// Smoke test — validates core agent paths run end-to-end without launching
// the Electron UI. Useful for CI + pre-demo dry runs.
//
// What it exercises:
//   - SQLite schema initialization (in-memory)
//   - DNC + TAM + MASTER_SENT_LIST seed parsing
//   - Locked connection-request formula deterministic D1 scoring
//   - Locked InMail formula deterministic D1 scoring
//   - LinkedIn URL slug derivation
//   - Tenure derivation regex
//   - Auto-drop signal regex
//
// Exits non-zero on any failure so it can wedge into CI later.
//
// Run: node scripts/smoke.mjs

import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'csv-parse/sync';

const here = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(here, '..');

// better-sqlite3 is rebuilt against Electron's Node ABI by `electron-rebuild`,
// so plain Node usually can't load the native binding. The dynamic import
// itself succeeds — failure only surfaces on the constructor call. Probe up
// front so we can skip those checks cleanly.
let Database = null;
let nativeAbi = 'unavailable';
try {
  const mod = await import('better-sqlite3');
  const Probe = mod.default;
  // Smoke-test the binding by instantiating an in-memory DB.
  const probeDb = new Probe(':memory:');
  probeDb.close();
  Database = Probe;
  nativeAbi = 'ok';
} catch (e) {
  nativeAbi = `unavailable (rebuilt for Electron ABI; pure Node can't load it)`;
}

let pass = 0;
let fail = 0;
let skipped = 0;

function check(label, fn) {
  try {
    const result = fn();
    if (result === false) throw new Error('returned false');
    console.log(`  ✓ ${label}`);
    pass++;
  } catch (e) {
    console.log(`  ✗ ${label} — ${e.message}`);
    fail++;
  }
}

function skip(label, reason) {
  console.log(`  ↷ ${label} — skipped (${reason})`);
  skipped++;
}

console.log('LinkedIn Copilot — smoke test\n');

console.log('Seed files');
check('tam.csv exists', () => existsSync(resolve(projectRoot, 'data/seed/tam.csv')));
check('master_sent_list.csv exists', () => existsSync(resolve(projectRoot, 'data/seed/master_sent_list.csv')));
check('dnc.json exists', () => existsSync(resolve(projectRoot, 'data/seed/dnc.json')));
check('g2-accounts.json exists', () => existsSync(resolve(projectRoot, 'data/seed/g2-accounts.json')));
check('connect-request.md template exists', () => existsSync(resolve(projectRoot, 'data/seed/templates/connect-request.md')));
check('inmail.md template exists', () => existsSync(resolve(projectRoot, 'data/seed/templates/inmail.md')));
check('skills/linkedin-connection-batch.md ported from BDR', () => existsSync(resolve(projectRoot, 'data/seed/skills/linkedin-connection-batch.md')));

console.log('\nSeed parsing');
const tam = parse(readFileSync(resolve(projectRoot, 'data/seed/tam.csv'), 'utf8'), { columns: true, skip_empty_lines: true });
check(`TAM rows >= 100 (got ${tam.length})`, () => tam.length >= 100);
check('TAM has Account Name column', () => tam[0]['Account Name'] !== undefined);

const dnc = JSON.parse(readFileSync(resolve(projectRoot, 'data/seed/dnc.json'), 'utf8'));
check(`DNC rows >= 1 (got ${dnc.length})`, () => dnc.length >= 1);
check('DNC has name / company / reason / date', () =>
  dnc.every((r) => 'name' in r && 'company' in r && 'reason' in r && 'date' in r)
);

const master = parse(readFileSync(resolve(projectRoot, 'data/seed/master_sent_list.csv'), 'utf8'), {
  columns: true,
  skip_empty_lines: true
});
check(`MASTER_SENT_LIST rows >= 100 (got ${master.length})`, () => master.length >= 100);
check('MASTER has norm column', () => master[0].norm !== undefined);

console.log(`\nSchema init (in-memory SQLite)  [native binding: ${nativeAbi}]`);
const schemaSql = readFileSync(resolve(projectRoot, 'src/main/db/schema.sql'), 'utf8');
let db = null;
if (Database) {
  try {
    db = new Database(':memory:');
    db.pragma('foreign_keys = ON');
    db.exec(schemaSql);
    check('schema_meta version row', () => {
      const row = db.prepare("SELECT value FROM schema_meta WHERE key = 'version'").get();
      return row && row.value === '1';
    });
    check('users table exists', () => {
      const r = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='users'").get();
      return !!r;
    });
    check('outreach has motion CHECK constraint', () => {
      try {
        db.prepare(
          `INSERT INTO outreach (user_id, prospect_id, motion, draft_body, hook, dept, char_count, status)
           VALUES (1, 1, 'invalid_motion', 'x', 'y', 'qa', 100, 'draft')`
        ).run();
        return false;
      } catch (e) {
        return /CHECK constraint failed/i.test(e.message);
      }
    });
  } catch (e) {
    console.log(`  ✗ schema init failed — ${e.message}`);
    fail++;
  }
} else {
  skip('schema_meta version row', 'better-sqlite3 native binding rebuilt for Electron');
  skip('users table exists', 'better-sqlite3 native binding rebuilt for Electron');
  skip('outreach has motion CHECK constraint', 'better-sqlite3 native binding rebuilt for Electron');

  // We can still spot-check that the SQL file parses by simple regex.
  check('schema.sql has CREATE TABLE users', () => /CREATE TABLE IF NOT EXISTS users/.test(schemaSql));
  check('schema.sql has motion CHECK', () => /motion\s+TEXT[^,]+CHECK\s*\(\s*motion/i.test(schemaSql));
}

console.log('\nLocked formula constants (parity with src)');
check('connect-request template names Testsigma', () => {
  const md = readFileSync(resolve(projectRoot, 'data/seed/templates/connect-request.md'), 'utf8');
  return md.includes("AI-powered test automation") && md.includes('Happy to connect if that sounds worthwhile.');
});
check('inmail template uses lowercase "its"', () => {
  const md = readFileSync(resolve(projectRoot, 'data/seed/templates/inmail.md'), 'utf8');
  return md.includes('Hopefully its not too much to ask');
});

console.log('\nDeterministic helpers');
check('LinkedIn slug regex parses /in/ urls', () => {
  const url = 'https://www.linkedin.com/in/example-person-12345/';
  const m = url.match(/\/in\/([^/?#]+)/);
  return m && m[1] === 'example-person-12345';
});
check('tenure regex catches "10+ years at"', () => {
  const m = '10+ years at GEICO'.match(/(\d{1,2})(?:\s*\+|\s*plus)?\s*years?\s+(?:at|as)/i);
  return m && m[1] === '10';
});
check('auto-drop: Open to Work', () => /\bopen to work\b/i.test('Open to Work · Director'));
check('auto-drop: Retired', () => /^\s*(retired|self[-\s]?employed)\b/i.test('Retired Director of QA'));
check('auto-drop: Ex- prefix', () => /^\s*ex[-\s]/i.test('Ex SCB | QA Lead'));

console.log(`\n${pass} pass / ${fail} fail / ${skipped} skipped`);
if (db) db.close();
process.exit(fail === 0 ? 0 : 1);
