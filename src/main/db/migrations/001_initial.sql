-- LinkedIn Copilot — SQLite schema v1
-- Multi-user-ready: every domain row has user_id. MVP only writes user_id=1 (Rob).

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS users (
  id              INTEGER PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  display_name    TEXT NOT NULL,
  apollo_api_key  TEXT,
  anthropic_api_key TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Account universe (TAM, Factor, G2, Other). Seeded from data/seed/tam.csv at install.
CREATE TABLE IF NOT EXISTS accounts (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  name            TEXT NOT NULL,
  domain          TEXT,
  linkedin_url    TEXT,
  location        TEXT,
  tier            TEXT NOT NULL CHECK (tier IN ('TAM', 'Factor', 'G2', 'Other')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_accounts_user_domain ON accounts(user_id, domain);
CREATE INDEX IF NOT EXISTS idx_accounts_user_name ON accounts(user_id, name COLLATE NOCASE);

-- Prospects we've researched. One row per LinkedIn URL per user.
CREATE TABLE IF NOT EXISTS prospects (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  account_id      INTEGER REFERENCES accounts(id),
  full_name       TEXT NOT NULL,
  first_name      TEXT NOT NULL,
  last_name       TEXT,
  linkedin_url    TEXT NOT NULL,
  linkedin_slug   TEXT,
  apollo_id       TEXT,
  title           TEXT,
  company_name    TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, linkedin_url)
);
CREATE INDEX IF NOT EXISTS idx_prospects_user_name ON prospects(user_id, full_name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_prospects_user_slug ON prospects(user_id, linkedin_slug);

-- Per-prospect LinkedIn evidence capture. One row per capture (we re-capture if stale > 24h).
CREATE TABLE IF NOT EXISTS evidence (
  id              INTEGER PRIMARY KEY,
  prospect_id     INTEGER NOT NULL REFERENCES prospects(id),
  captured_at     TEXT NOT NULL DEFAULT (datetime('now')),
  captured_via    TEXT NOT NULL,             -- public-profile | sales-nav-lead-page
  live_headline   TEXT,
  live_location   TEXT,
  connection_degree TEXT,                    -- '1st' | '2nd' | '3rd' | 'OUT-OF-NETWORK'
  follower_count  INTEGER,
  connection_count INTEGER,
  activity_status TEXT,                      -- LINKEDIN-QUIET | ACTIVE
  activity_quotes TEXT,                      -- JSON array of strings
  evidence_quote_for_hook TEXT,              -- the verbatim string the draft hook anchors to
  raw_capture     TEXT,                      -- full page text snapshot
  notes           TEXT
);
CREATE INDEX IF NOT EXISTS idx_evidence_prospect ON evidence(prospect_id, captured_at DESC);

-- One row per outreach attempt. Status moves draft -> queued -> sent -> accepted/replied/declined/failed.
CREATE TABLE IF NOT EXISTS outreach (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  prospect_id     INTEGER NOT NULL REFERENCES prospects(id),
  evidence_id     INTEGER REFERENCES evidence(id),
  motion          TEXT NOT NULL CHECK (motion IN ('connection_request','sales_nav_inmail')),
  draft_body      TEXT NOT NULL,
  draft_subject   TEXT,                      -- only for InMail
  hook            TEXT NOT NULL,             -- the {hook} substitution
  dept            TEXT NOT NULL,             -- the {dept} substitution
  char_count      INTEGER NOT NULL,
  confidence      REAL,                      -- 0.0 - 10.0
  confidence_notes TEXT,                     -- JSON: {d1,d2,d3,fail_reasons}
  status          TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','queued','sent','accepted','replied','declined','failed','dropped')),
  status_reason   TEXT,
  drafted_at      TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at         TEXT,
  accepted_at     TEXT,
  replied_at      TEXT,
  reply_body      TEXT
);
CREATE INDEX IF NOT EXISTS idx_outreach_user_status ON outreach(user_id, status);
CREATE INDEX IF NOT EXISTS idx_outreach_prospect ON outreach(prospect_id, drafted_at DESC);

-- Do-Not-Contact list. Seeded from BDR/CLAUDE.md; user can add/remove freely.
CREATE TABLE IF NOT EXISTS dnc (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  name_norm       TEXT NOT NULL,             -- lowercase full name for grep
  display_name    TEXT NOT NULL,
  company         TEXT,
  reason          TEXT,
  added_at        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_dnc_user_norm ON dnc(user_id, name_norm);

-- Prior-contact ledger seeded from BDR/MASTER_SENT_LIST.csv. Used by Phase 0.6 prior-contact gate.
CREATE TABLE IF NOT EXISTS prior_contacts (
  id              INTEGER PRIMARY KEY,
  user_id         INTEGER NOT NULL REFERENCES users(id),
  name_norm       TEXT NOT NULL,
  display_name    TEXT NOT NULL,
  channel         TEXT,                       -- Email T1, LinkedIn Connection, etc.
  send_date       TEXT,
  source          TEXT                        -- e.g., 'master_sent_list_seed' | 'app'
);
CREATE INDEX IF NOT EXISTS idx_prior_user_norm ON prior_contacts(user_id, name_norm);

-- Daily analytics rollup. Populated by reconciliation jobs.
CREATE TABLE IF NOT EXISTS analytics_daily (
  user_id         INTEGER NOT NULL REFERENCES users(id),
  day             TEXT NOT NULL,             -- YYYY-MM-DD
  motion          TEXT NOT NULL,
  drafted         INTEGER NOT NULL DEFAULT 0,
  sent            INTEGER NOT NULL DEFAULT 0,
  accepted        INTEGER NOT NULL DEFAULT 0,
  replied         INTEGER NOT NULL DEFAULT 0,
  declined        INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, day, motion)
);

-- Audit trail: every gate decision per outreach attempt.
CREATE TABLE IF NOT EXISTS gate_log (
  id              INTEGER PRIMARY KEY,
  outreach_id     INTEGER REFERENCES outreach(id),
  prospect_id     INTEGER REFERENCES prospects(id),
  phase           TEXT NOT NULL,             -- '0.5' | '0.6' | '0.7' | '0.7.5' | '1.5' | '3' | '7.5'
  decision        TEXT NOT NULL CHECK (decision IN ('pass','drop','warn')),
  reason          TEXT,
  meta            TEXT,                      -- JSON
  ts              TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_gate_log_outreach ON gate_log(outreach_id, ts);

-- Schema version row for future migrations.
CREATE TABLE IF NOT EXISTS schema_meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
INSERT OR IGNORE INTO schema_meta (key, value) VALUES ('version', '1');
