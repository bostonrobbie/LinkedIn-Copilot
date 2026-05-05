-- Migration 004 — onboarding state per user.
--
-- Replaces the localStorage-based "first run completed" flag with a per-step
-- DB row so reinstalls / multi-rep prep can re-prompt correctly.

CREATE TABLE IF NOT EXISTS onboarding_steps (
  user_id     INTEGER NOT NULL REFERENCES users(id),
  step_id     TEXT NOT NULL,             -- 'welcome' | 'linkedin' | 'salesnav' | 'anthropic' | 'apollo' | 'tam' | 'demo' | 'done'
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'skipped')),
  completed_at TEXT,
  meta        TEXT,                      -- JSON for step-specific metadata
  PRIMARY KEY (user_id, step_id)
);

CREATE INDEX IF NOT EXISTS idx_onboarding_status ON onboarding_steps(user_id, status);
