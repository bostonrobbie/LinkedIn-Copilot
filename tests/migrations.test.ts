// Tests that the migration manifest stays consistent.

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS_DIR = resolve(process.cwd(), 'src/main/db/migrations');
const MIGRATE_TS = resolve(process.cwd(), 'src/main/db/migrate.ts');

describe('schema migrations', () => {
  it('migrations directory contains versioned .sql files', () => {
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      expect(f).toMatch(/^\d{3}_[a-z0-9_]+\.sql$/);
    }
  });

  it('migrate.ts registers every migration file', () => {
    const ts = readFileSync(MIGRATE_TS, 'utf8');
    const files = readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql'));
    for (const f of files) {
      expect(ts).toContain(`migrations/${f}`);
    }
  });

  it('migration versions are sequential starting from 1', () => {
    const ts = readFileSync(MIGRATE_TS, 'utf8');
    const versionMatches = [...ts.matchAll(/\bversion:\s*(\d+),/g)].map((m) => Number(m[1]));
    expect(versionMatches.length).toBeGreaterThan(0);
    expect(versionMatches[0]).toBe(1);
    for (let i = 1; i < versionMatches.length; i++) {
      expect(versionMatches[i]).toBe(versionMatches[i - 1] + 1);
    }
  });

  it('001_initial.sql has the users table', () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, '001_initial.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE.*users/i);
  });

  it('002_encrypted_keys.sql adds *_enc columns', () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, '002_encrypted_keys.sql'), 'utf8');
    expect(sql).toMatch(/anthropic_api_key_enc/);
    expect(sql).toMatch(/apollo_api_key_enc/);
  });

  it('003_send_queue.sql creates send_queue table with status check', () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, '003_send_queue.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE.*send_queue/i);
    expect(sql).toMatch(/CHECK\s*\(\s*status\s+IN/i);
  });

  it('004_onboarding.sql creates onboarding_steps with status check', () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, '004_onboarding.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE.*onboarding_steps/i);
    expect(sql).toMatch(/CHECK\s*\(\s*status\s+IN.*pending.*completed.*skipped/is);
  });

  it('005_mvp_completion.sql adds Apollo enrichment + tier + reply classifier columns', () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, '005_mvp_completion.sql'), 'utf8');
    expect(sql).toMatch(/apollo_company/i);
    expect(sql).toMatch(/apollo_employment/i);
    expect(sql).toMatch(/experience_subpage/i);
    expect(sql).toMatch(/reply_classification/i);
    expect(sql).toMatch(/\btier\b/i);
    expect(sql).toMatch(/auto_added_reason_kind/i);
  });

  it('006_classification_overrides.sql creates audit table with prior/new value columns', () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, '006_classification_overrides.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE.*classification_overrides/i);
    expect(sql).toMatch(/prior_value/i);
    expect(sql).toMatch(/new_value/i);
    expect(sql).toMatch(/source.*manual.*reclassify.*bulk/is);
  });

  it('007_app_state.sql creates key/value table for cross-session timers', () => {
    const sql = readFileSync(resolve(MIGRATIONS_DIR, '007_app_state.sql'), 'utf8');
    expect(sql).toMatch(/CREATE TABLE.*app_state/i);
    expect(sql).toMatch(/PRIMARY KEY/i);
  });
});
