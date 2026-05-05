# PROJECT_CONTEXT.md — LinkedIn Copilot

**Mission, goals, and current state. Read this once per session to ground yourself.**

---

## Why this exists

Rob Gorham is a BDR at **Testsigma** (agentic AI test-automation platform, founded 2019, ~196 employees, $12.8M Series A). He owns LinkedIn outreach to QA / engineering leaders inside a TAM of 312 accounts plus 38 Factor accounts.

Over the past year, Rob's BDR system evolved into a heavily-instrumented operation: 50+ batches sent, 30+ INC-* incident learnings codified into rules, two locked draft formulas (one for connection requests, one for InMails), an 8-gate quality system, and an 8-phase daily process documented across `memory/`, `playbooks/`, and `skills/` in his BDR repo.

**The pain point**: every batch still requires Rob to manually drive Sales Nav, fetch profile data, write drafts against the locked formulas, run gate checks, score with the MQS rubric, then click Send carefully (one INC-022 wrong-company error costs a credit and a relationship). It's roughly 30-45 minutes per prospect even with skills as guides.

**The bet**: build a desktop app that automates the mechanical 80% of that loop while keeping the locked formulas, gate checks, and send-safety incident rules **immutable in code**. Target: 5 minutes per prospect, with Rob as the human-in-the-loop approver at the QA + send moments.

---

## Hackathon goals

- **Demo deadline: May 6, 2026** (tomorrow as of last session)
- **Demo flow**: single prospect end-to-end in <5 min — paste Sales Nav URL → app fetches profile → runs 8 gates → drafts against locked formula → QA-scores → presents to user → user approves → app sends with INC-022 readback verification → records to local SQLite
- **Stretch**: bulk batch flow (paste 5 URLs, parallelize gates, present batch QA dashboard)
- **Don't ship**: cloud sync, multi-user, web version, mobile

---

## What it does (today — Days 1-16 shipped)

| Capability | Status |
|---|---|
| Single-prospect end-to-end (Connect motion) | ✅ |
| Single-prospect end-to-end (InMail motion) | ✅ |
| Bulk batch flow | ✅ |
| Auto-prospect-enroll mode | ✅ |
| 8 BDR gates (TAM check, DNC check, persona match, career-arc detect, prior-contact dedup, LinkedIn-degree, deliverability, evidence freshness) | ✅ |
| Locked Connect-request formula (BDR INC-022 v1) | ✅ |
| Locked InMail 5-paragraph hero formula | ✅ |
| MQS scoring (Opus 4.7) with auto-retry on Zod validation fail | ✅ |
| Playwright-driven Sales Nav profile capture | ✅ |
| Playwright-driven Connect send + InMail send | ✅ |
| INC-022 readback safety on send | ✅ |
| INC-027 strict aria-label match | ✅ |
| INC-028 throttle (10/day, 80/100 over 7d) | ✅ |
| INC-030 stop-loss (1-retry cap + auto-DNC) | ✅ |
| Phase 9.0 4-profile control sampling | ✅ |
| Phase 9.0.5 7-day cooldown timer | ✅ |
| Phase 9.6 end-of-session reconciliation | ✅ |
| Reply classifier (P0_warm / P1_engaged / P2_decline / P3_auto_reply / P4_hostile) | ✅ |
| Auto-DNC on hostile reply | ✅ |
| Apollo provider abstraction (api / ui / none / auto) | ✅ |
| Apollo employment parsing for prior-tenure detection | ✅ |
| Onboarding flow with DB-backed step state | ✅ |
| Settings UI (API keys via OS keychain, provider mode, throttle override, cooldown clear) | ✅ |
| Health page (12 preflight checks) | ✅ |
| Audit page (full event log) | ✅ |
| Send queue with backoff (1m → 5m → 15m → 60m → 240m, max 5 attempts) | ✅ |
| Watchdog timeouts on Playwright (90s capture, 60s connect, 90s InMail) | ✅ |

**Tests:** 149 passing across 17 test files. **Lint:** 0/0. **Smoke:** 22 pass / 3 skip (DB requires Electron ABI).

---

## Architecture (skim — full version in README.md)

```
Renderer (React/Tailwind) → preload contextBridge → Main (Node)
                                                      ├── agent/  (orchestrator, gates, drafting, qa, sending, sendQueue, replyClassifier, careerArc, autoProspect)
                                                      ├── browser/ (Playwright session, linkedin, watchdog)
                                                      ├── db/ (better-sqlite3 + 7 migrations)
                                                      ├── secrets.ts (Electron safeStorage → OS keychain)
                                                      ├── apollo (api/ui provider)
                                                      └── llm (Anthropic SDK: Sonnet 4.6 hooks, Opus 4.7 QA)
```

**Key design decisions** (full text in `docs/adrs/`):
- ADR-0001: Electron over Tauri (mature Playwright integration, simpler safeStorage)
- ADR-0002: Local-first SQLite (no cloud, full offline, regulatory-friendly)
- ADR-0003: Anthropic model split (Sonnet for fast hooks, Opus for QA scoring)
- ADR-0004: Locked formulas (BDR INC-022 v1 connection-request, 5-paragraph InMail hero — immutable, enforced in `src/main/agent/drafting.ts`, codified in `tests/drafting.test.ts`)

---

## Outstanding v7 BDR alignment gaps

Tracked in `SKILL_GAPS.md`. None block demo:

1. **Phase 9.4 MASTER_SENT_LIST.csv append** — every successful send should append to Rob's BDR repo's MASTER_SENT_LIST. Cross-repo coupling — design tradeoff. Discuss with Rob: shell-out path, GitHub API push, or file-watcher.
2. **Gate 0.7 Gmail integration** — pre-send check that prospect has no existing Gmail thread with Rob. ~4h+ lift (OAuth + Gmail API + dedup logic).
3. **Sales Nav right-panel capture** — new "lead-panel" data motion (separate from full profile). Spec'd in `data/seed/playbooks/sales-nav-data-fetch.md`.

---

## Voice rules (encoded in drafting.ts + drafting.test.ts)

These are the BDR-locked rules from Rob's broader sales-ops doctrine. The app enforces them at draft time:

- **No em dashes anywhere.** Use commas. Minimize hyphens.
- **75–99 words sweet spot** for Touch 1 emails (39.0% reply rate in Rob's data).
- **"What day works" CTA** for TAM outbound — 40.4% reply rate. Not for inbound.
- **"Cheers,"** sign-off only on emails. Never "— Rob".
- **Lowercase "its"** intentional in the InMail hero formula (Rob's voice).

---

## Send-safety incident lineage (encoded in tests)

| Incident | Lesson | Where enforced |
|---|---|---|
| INC-022 | Wrong-company text injected at send time | `src/main/agent/sending.ts` readback gate, `tests/wrong-company.test.ts` |
| INC-027 | Aria-label fuzzy match selected wrong button | `src/main/browser/linkedin.ts` strict `Invite ${name} to connect` match |
| INC-028 | Daily/weekly throttle drift | `src/main/agent/sending.ts` cap check + cooldown |
| INC-030 | InMail credit-burn on LinkedIn-side blocks | `src/main/agent/sending.ts` 1-retry cap + auto-DNC append |

Career-arc auto-DNC adds 4 more banned categories: claims-ops, banking-compliance, hardware-defense, clinical-pharma. Tested in `tests/career-arc.test.ts`.

---

## Bundled BDR source-of-truth

`data/seed/` is a snapshot of Rob's BDR rules at the time of vendor-in. The app loads these at runtime; the Playbook page renders them. This is the **only authorized BDR data inside the app** — do not pull more from the parent repo without Rob's explicit approval.

| File | What |
|---|---|
| `data/seed/skills/linkedin-connection-batch.md` | v7 Connect-request batch process (971 lines) |
| `data/seed/skills/inmail-batch-v2.md` | v3.2 InMail batch process (1355 lines) |
| `data/seed/skills/linkedin-connect.md` | Per-prospect Connect skill |
| `data/seed/playbooks/linkedin-batch-quality-gate.md` | 8-gate quality system |
| `data/seed/playbooks/linkedin-send-preflight.md` | Pre-send checklist |
| `data/seed/playbooks/inmail-batch-process-v2.md` | InMail process detail |
| `data/seed/playbooks/sales-nav-data-fetch.md` | Right-panel capture spec (not yet implemented — gap #3 above) |
| `data/seed/templates/connect-request.md` | Locked Connect formula reference |
| `data/seed/templates/inmail.md` | Locked InMail formula reference |
| `data/seed/dnc.json` | Bundled DNC subset (74 entries) |
| `data/seed/master_sent_list.csv` | Bundled sent-list snapshot (856 rows) |
| `data/seed/g2-accounts.json` | G2 intent accounts |
| `data/seed/tam.csv` | TAM accounts (312) |

**To re-sync** when BDR rules update: copy from parent `BDR/skills/`, `BDR/memory/playbooks/`, `BDR/MASTER_SENT_LIST.csv` (subset), etc. Document the sync commit hash in CHANGELOG.md.

---

## Demo dry-run checklist

Before May 6:

1. Walk Onboarding flow with real Anthropic + Apollo keys
2. Single-prospect Connect dry-run on real Sales Nav URL — stop at readback, confirm gates fire correctly
3. Single-prospect InMail dry-run — same
4. Run `npm test` — 149/149
5. Run `node scripts/smoke.mjs` — 25/0/0 under Electron, 22/0/3 under plain Node
6. Build: `npm run package` → confirm `out/linux-unpacked/` is ~299 MB and launches

---

## What you should NOT build

Per Rob's explicit rules across the 16-day build:

- No new features without explicit ask
- No refactors that aren't required
- No abstractions for hypothetical future requirements
- No backwards-compatibility shims
- No comments that explain what the code does (use names instead)
- No documentation files unless asked

If something feels broken, fix it. If something feels missing, **ask Rob first.**
