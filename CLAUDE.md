# CLAUDE.md — LinkedIn Copilot (scoped)

**You are working on the LinkedIn Copilot Electron app inside `bostonrobbie/BDR`'s `linkedin-copilot/` subdirectory.**

This file is a **scope boundary**. The parent BDR repo at `../` is Rob Gorham's BDR sales-ops workspace — full of customer data, DNC lists, batch trackers, sent-list CSVs, and operational memory. **You do not need any of that to work on this app.** The data the app needs has been bundled under `data/seed/`.

---

## Hard scope rules

1. **Only modify files inside `linkedin-copilot/`.** Never edit, create, or delete anything in the parent BDR repo (no files at `../*`, `../memory/`, `../batches/`, `../analytics/`, `../sequences/`, `../skills/`, `../MASTER_SENT_LIST.csv`, `../tam-accounts-mar26.csv`, `../CLAUDE.md`, `../AGENTS.md`).
2. **Only read what's needed.** If you need to reference BDR rules, read `data/seed/skills/` and `data/seed/playbooks/` — those are bundled snapshots already authorized for the app. Do not read the parent BDR memory directly.
3. **No data leak in commits.** Don't copy, snapshot, or summarize parent BDR ops files into commits, code, comments, or chat output. The bundled `data/seed/` is the canonical authorized subset.
4. **Don't push to BDR root.** All your work lives under `linkedin-copilot/`. Any PR you open should only touch files under that path.

If a task seems to require touching the parent BDR repo, **stop and ask Rob first.**

---

## What this app is

**LinkedIn Copilot** — Electron desktop app that automates Rob's LinkedIn Sales Nav outreach end-to-end. End goal: research → 8 BDR gates → locked-formula drafting → QA scoring → Playwright-driven send → reply lifecycle, all under 5 minutes per prospect.

**Hackathon demo: May 6, 2026.** Today's session is the last working day before demo.

**Status:** MVP complete. 149/149 tests passing. Both motions (Connect + InMail) shipped. Day 16 v7 BDR rules wired in.

---

## Read these in order, every session

1. **`NEXT_SESSION.md`** — local pickup runbook (boot the app in 5 min)
2. **`PROJECT_CONTEXT.md`** — mission, goals, why this exists, what it does
3. **`AGENTS.md`** — agent protocol scoped to this subdirectory
4. **`CHANGELOG.md`** — what changed each day (Days 1-16)
5. **`SKILL_GAPS.md`** — outstanding v7 alignment items

Reference on demand:
- `README.md` — architecture + Mermaid diagrams
- `HANDOFF.md` — in-project agent handoff (older, mostly superseded by NEXT_SESSION.md)
- `TROUBLESHOOTING.md` — operational runbook
- `RUNBOOK.md` — desktop install/setup
- `docs/adrs/` — architecture decisions

---

## Critical operating rules (encoded in code + tests — do not loosen)

- **INC-022 readback**: every send extracts → injects → reads back → char-for-char compares. Mismatch halts. Tests in `tests/wrong-company.test.ts`.
- **INC-027 strict aria-label**: connect button must match `Invite ${expectedFullName} to connect` exactly.
- **INC-028 throttle**: 10/day, 80/100 over 7 days, auto-cooldown.
- **INC-030 stop-loss**: max 1 retry per failed InMail, then auto-DNC.
- **Locked connection-request formula** (BDR INC-022 v1) is **immutable**. Enforced D1 in `src/main/agent/drafting.ts`.
- **Tier B is BANNED** in v7. Only Tier A / A+ / A++ ship.
- **Phase 9.0 control sampling**: 4-profile probe before any send. All 4 missing Connect → halt.
- **Career-arc auto-DNC**: claims-ops, banking-compliance, hardware-defense, clinical-pharma — see `tests/career-arc.test.ts`.

Full BDR rule source-of-truth: `data/seed/skills/linkedin-connection-batch.md` (v7, 971 lines) and `data/seed/skills/inmail-batch-v2.md` (v3.2, 1355 lines).

---

## Tech stack (one-liner)

Electron 33 + Vite + React 18 + Tailwind (renderer) → typed IPC → Node main process → Playwright (persistent Chromium profile) + better-sqlite3 + Anthropic SDK (Sonnet 4.6 hooks, Opus 4.7 QA).

---

## Boot in 5 minutes

```bash
cd linkedin-copilot
npm install --legacy-peer-deps   # --legacy-peer-deps REQUIRED (husky/lint-staged conflict)
npx playwright install chromium  # one-time
npm test                         # expect 149/149
npm run dev                      # launches Electron
```

If `better-sqlite3` errors: `npm rebuild better-sqlite3`.

---

## Commit / PR rules

- Branch directive: `claude/linkedin-sales-automation-DJK2c` (or open a new `claude/<topic>` branch for distinct work).
- Sign commits if signing infra works; if it returns 400 in a dev container, ask Rob before bypassing with `--no-gpg-sign`.
- All PRs must touch files under `linkedin-copilot/` only.
- Open as **draft** by default unless Rob explicitly says merge.

---

## Tone in code

- Don't add comments unless the WHY is non-obvious.
- Don't add features Rob didn't ask for.
- Don't refactor scope-creep.
- Tests are the source of truth — if you change a rule, update the test.
