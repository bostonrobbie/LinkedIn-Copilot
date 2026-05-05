-- Migration 002 — encrypted API keys at rest.
--
-- Old columns `apollo_api_key` / `anthropic_api_key` stored plaintext. These
-- are kept (cleared at upgrade time) and replaced by `*_enc` BLOB columns
-- holding Electron safeStorage-encrypted bytes (OS keychain backed).
--
-- The migration script is idempotent: ADD COLUMN IF NOT EXISTS isn't supported
-- in SQLite directly, so we use a probe pattern via PRAGMA table_info that the
-- runner inspects ahead of running. To keep this file simple, we just ALTER
-- with the assumption it's run once. Subsequent runs are skipped via user_version.

ALTER TABLE users ADD COLUMN apollo_api_key_enc BLOB;
ALTER TABLE users ADD COLUMN anthropic_api_key_enc BLOB;

-- Clear plaintext columns; the main process will re-encrypt on next save.
UPDATE users SET apollo_api_key = NULL, anthropic_api_key = NULL
  WHERE apollo_api_key IS NOT NULL OR anthropic_api_key IS NOT NULL;
