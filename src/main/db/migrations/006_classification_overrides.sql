-- Migration 006 — classification override audit trail.
--
-- When a user manually overrides a reply classification, we capture an audit
-- row so we can analyze classifier accuracy over time + see who/why on a
-- contested classification.

CREATE TABLE IF NOT EXISTS classification_overrides (
  id              INTEGER PRIMARY KEY,
  outreach_id     INTEGER NOT NULL REFERENCES outreach(id),
  user_id         INTEGER NOT NULL REFERENCES users(id),
  prior_value     TEXT,                       -- the classification before override
  new_value       TEXT,                       -- the classification after override
  reason          TEXT,                       -- optional user-supplied reason
  source          TEXT NOT NULL DEFAULT 'manual',  -- 'manual' | 'reclassify' | 'bulk'
  ts              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_classification_overrides_outreach ON classification_overrides(outreach_id, ts);
CREATE INDEX IF NOT EXISTS idx_classification_overrides_user ON classification_overrides(user_id, ts DESC);
