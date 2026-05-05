# ADR 0002 — Local-first storage, multi-user-ready schema

**Status:** accepted, May 4, 2026
**Context:** where prospect / outreach / evidence data lives

## Decision

All MVP data lives in SQLite at `userData/db/app.sqlite`. The schema is multi-user-ready (every domain row has `user_id`) but the MVP only writes `user_id = 1` (Rob).

## Why not a server

1. **Hackathon timeline.** A working desktop app in 5–7 days vs a server + auth + sync layer in 14+.
2. **LinkedIn cookies live on the laptop.** Playwright's persistent profile is local. A server-side architecture would require shipping cookies up to the server (security risk) or running Playwright server-side (loses the "agent uses my browser" property).
3. **Privacy.** API keys, draft history, evidence captures are local. Nothing leaves the machine without explicit user action.
4. **Cost.** No per-user infrastructure expense during the MVP / hackathon period.

## Multi-user readiness

The data layer is ready for multi-rep without schema changes:

- `users` table is the authority; every domain row references `user_id`.
- `accounts`, `prospects`, `outreach`, `dnc`, `prior_contacts`, `evidence`, `gate_log`, `send_queue`, `analytics_daily`, `onboarding_steps` all have `user_id` columns and indexed lookups.
- Encrypted-at-rest API keys live per user (`users.anthropic_api_key_enc`, `apollo_api_key_enc`).

## Tradeoffs

- No central observability across reps. Manager rollups are deferred until we add a sync layer.
- Backups are per-machine; export/import is the recovery story for now.
- Schema changes ship as versioned migrations (`PRAGMA user_version`) so existing installs upgrade cleanly.

## When to revisit

When we add rep #2 in production OR when manager rollup becomes valuable, add a backend with a syncing layer. Until then, local-first is the right default.
