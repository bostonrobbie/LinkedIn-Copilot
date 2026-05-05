-- Migration 003 — persistent retry queue for failed sends.
--
-- approveAndSend on transient failure (Playwright timeout, LinkedIn glitch)
-- enqueues here. A background worker scans the queue every minute and retries
-- with exponential backoff. Survives app crash.

CREATE TABLE IF NOT EXISTS send_queue (
  id              INTEGER PRIMARY KEY,
  outreach_id     INTEGER NOT NULL REFERENCES outreach(id),
  user_id         INTEGER NOT NULL REFERENCES users(id),
  attempts        INTEGER NOT NULL DEFAULT 0,
  max_attempts    INTEGER NOT NULL DEFAULT 5,
  last_error      TEXT,
  next_attempt_at TEXT NOT NULL DEFAULT (datetime('now')),
  status          TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','exhausted','done','cancelled')),
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_send_queue_next ON send_queue(status, next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_send_queue_outreach ON send_queue(outreach_id);
