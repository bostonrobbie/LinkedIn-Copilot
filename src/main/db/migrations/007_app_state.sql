-- Migration 007 — app-level key/value state.
--
-- Used for cross-session timers + status flags that don't belong on the user
-- row (e.g., INC-028 rate-limit cooldown timestamp, last end-of-session
-- reconciliation run, last 4-profile control-sample result).

CREATE TABLE IF NOT EXISTS app_state (
  key         TEXT PRIMARY KEY,
  value       TEXT NOT NULL,
  meta        TEXT,                              -- JSON for structured payloads
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);
