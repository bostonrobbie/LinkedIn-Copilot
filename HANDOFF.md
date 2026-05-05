# Handoff for the next agent session

You're picking up the LinkedIn Copilot — a desktop Electron app that automates the front-end of LinkedIn outreach for Testsigma BDRs/AEs (Rob Gorham is the user). Read this first, then `RUNBOOK.md` for the user-facing setup, then `Playbook` (in-app) or `data/seed/templates/` for the locked formulas.

## What this app is

Single-rep MVP (multi-rep-ready data model). Takes a LinkedIn profile URL, runs a 7-gate research pipeline, drafts using locked BDR formulas, scores against a 9.0/10 confidence floor, then sends via Playwright with INC-022-style readback. Hero motion: connection request. Second motion: Sales Nav InMail.

## What's done (Days 1 through 16)

| Layer | Status |
| --- | --- |
| Electron 33 + Vite + TypeScript + React 18 + Tailwind | ✅ |
| SQLite schema (10 tables) seeded from BDR (312 TAM, 6 G2, 74 DNC, 856 prior contacts) | ✅ |
| Playwright persistent profile, LinkedIn login flow, hardened public-profile capture | ✅ |
| Phase gates 0.5 / 0.6 / 0.7 / 0.7.5 / 1.5 / 3 (Apollo stub) | ✅ |
| LinkedIn connection-request send (INC-022 readback) | ✅ |
| Sales Nav InMail send (subject + body readback) | ✅ |
| Anthropic SDK (Sonnet for hooks, Opus for D2/D3) — graceful heuristic fallback | ✅ |
| Phase 7.5 confidence gate with one-round remediation | ✅ |
| Reply-sync worker (invitation manager + inbox scan, on-demand + 15-min background) | ✅ |
| Analytics dashboard | ✅ |
| Pipeline audit log + per-prospect drill-down | ✅ |
| Edit draft inline + live D1 re-score + LLM re-score | ✅ |
| Simulate-send mode (no LinkedIn touch) + 3 demo-seed prospects | ✅ |
| Header health banner + toast notifications + first-run onboarding overlay | ✅ |
| Playbook viewer (locked formulas + gate definitions + INC-022/026 protocols) | ✅ |
| Vitest + 50 deterministic tests (gates, drafting, qa, inmail, research helpers) | ✅ |
| GitHub Actions CI (typecheck + test on push) | ✅ |
| ESLint + Prettier baseline | ✅ |
| Keyboard shortcuts (Cmd+1-8, Cmd+N, Cmd+K, Cmd+/) | ✅ |
| Pipeline progress visualization (vertical stepper) | ✅ Day 4 |
| Bulk-import flow (paste N URLs, sequential pipeline) | ✅ Day 4 |
| CSV export of Activity | ✅ Day 4 |
| Today's Actions on Home (replaces counters with action cards) | ✅ Day 4 |
| Accounts drill-down (per-account prospects + outreach) | ✅ Day 4 |
| Command palette (Cmd+K, fuzzy search) | ✅ Day 4 |
| Preflight self-test (11 checks) + System Health page | ✅ Day 5 |
| Log tail surfaced in-app | ✅ Day 5 |
| Zod-validated LLM responses with auto-retry | ✅ Day 5 |
| React error boundaries per page | ✅ Day 5 |
| LinkedIn selector chain fallbacks (degree, counts, about, title, company) | ✅ Day 5 |
| Anthropic 429 backoff with surfaced retry status | ✅ Day 6 |
| `npm run smoke` (22 checks, native-binding-aware) | ✅ Day 6 |
| Versioned schema migrations (PRAGMA user_version) | ✅ Day 6 |
| SQLite backup / restore (auto-prune to 20 snapshots) | ✅ Day 6 |
| LinkedIn session-expiry auto-recover (auth_required event + login flow + resume) | ✅ Day 6 |
| Playwright Chromium auto-install (one-click from Health page) | ✅ Day 6 |
| `npm run package` verified end-to-end (299 MB linux-unpacked, seed bundled) | ✅ Day 7 |
| API keys encrypted at rest via Electron `safeStorage` | ✅ Day 7 |
| Persistent send-queue with backoff retry worker (1m/5m/15m/60m/240m) | ✅ Day 7 |
| Playwright watchdog (90s capture / 60s connect / 90s InMail) | ✅ Day 7 |
| Husky + lint-staged pre-commit hook | ✅ Day 7 |
| Module-boundary ESLint rules (renderer ↛ main, main ↛ React) | ✅ Day 7 |
| Mermaid architecture / sequence / ER diagrams in README | ✅ Day 7 |
| Test coverage 50 → 73 (watchdog, secrets, log-tail, migrations) | ✅ Day 7 |
| Sales Nav as independent session (separate state, header pill, preflight) | ✅ Day 8 |
| Apollo provider abstraction (api / ui / off / auto) + Phase 3 dedup wired | ✅ Day 8 |
| Onboarding v2: 8-step DB-tracked flow, resumable, re-runnable | ✅ Day 8 |
| Settings sectioned (Account / Sessions / Keys / Data / Advanced) + open-folder buttons | ✅ Day 8 |
| Auto-backup scheduler + pre-restore snapshot + integrity check | ✅ Day 8 |
| 4 ADRs (Electron, local-first, model split, locked formulas) | ✅ Day 8 |
| Phase 0.6 4-source reply-check ladder | ✅ Day 9 |
| Phase 1.5b wrong-company gate (Apollo vs LinkedIn cross-check) | ✅ Day 9 |
| Patch-and-re-QA loop (D2/D3 re-runs on edit) | ✅ Day 9 |
| Hook tier classification (A/A+/A++) surfaced in UI | ✅ Day 9 |
| INC-030 stop-loss (cap InMail retries at 1, auto-DNC on burn) | ✅ Day 9 |
| Single-instance lock | ✅ Day 9 |
| Reply classifier (Opus P0-P4) + auto-DNC on hostile | ✅ Day 9 |
| Reply context card on OutreachDetail | ✅ Day 9 |
| Warm-lead re-engagement scanner in Today's Actions | ✅ Day 9 |
| Sales Nav Rung 4 capture (`/details/experience/`) | ✅ Day 9 |
| Real Apollo `/v1/people/match` + `/v1/mixed_people/search` API integration | ✅ Day 10 |
| Career-arc detection (claims-ops / banking-compliance / hardware-defense / clinical-pharma + career-grown-internal positive) | ✅ Day 10 |
| Slug preflight on LinkedIn 404 / unavailable | ✅ Day 10 |
| 7-day rolling throttle (INC-028 weekly cap awareness, 80 soft / 100 hard) | ✅ Day 10 |
| Pre-resume control-profile check (control profile after ≥24h pause) | ✅ Day 10 |
| Auto-prospect-enroll batch flow (TAM account → Apollo search → pre-screen → ranked drafts) | ✅ Day 10 |
| Send Queue UI (sidebar tab + retry/cancel + re-queue from OutreachDetail) | ✅ Day 11 |
| API key health validation (inline `Check key health` in Settings + Show/Hide toggle) | ✅ Day 11 |
| Reply re-classify button + manual P0-P4 override + auto-DNC reversal | ✅ Day 11 |
| URL normalization + dedup in bulk paste (lowercase, query stripping, Sales Nav / pub rejection) | ✅ Day 11 |
| Auto-reload renderer after backup restore | ✅ Day 11 |
| TROUBLESHOOTING.md operational runbook | ✅ Day 11 |
| Apollo enrichment panel on OutreachDetail (career history + mismatch flags) | ✅ Day 12 |
| Bulk classification override + bulk auto-DNC reversal in Activity | ✅ Day 12 |
| Classification override audit trail (`classification_overrides` table) | ✅ Day 12 |
| Drop-rate health signal in Today's Actions (warn at 20%, alert at 50%) | ✅ Day 12 |
| Day 12 follow-on polish (audit history render, bulk reason, Cmd+A/Esc, Re-source CTA, date format) | ✅ Day 13 |
| Apollo employment parsing (career-grown-internal precise + tenure-from-Apollo + job-hopper signal) | ✅ Day 14 |
| BDR skill refresh — synced to origin/main `26806de` (v7 connection-batch + inmail-batch-v2 v3.2 + sales-nav-data-fetch playbook) | ✅ Day 15 |
| Rung 4 restricted-page explicit handling (`RESTRICTED:` marker on subpage capture) | ✅ Day 16 |
| Rung 3 freshness gate (<24h evidence required pre-send, override flag available) | ✅ Day 16 |
| 4-profile control sampling for Phase 9.0 rate-limit detection | ✅ Day 16 |
| Phase 9.0.5 7-day cooldown timer in `app_state` + Health surfacing + Settings clear-cooldown | ✅ Day 16 |
| Phase 9.6 end-of-session reconciliation report (Analytics tab, by motion/status/drops/queue/7d) | ✅ Day 16 |

## What's NOT done (intentional, post-demo)

- **Batch mode** — TAM-driven prospecting, ranked candidate list. Skipped because the 5-min demo doesn't need it. Would be the next big feature.
- **Real Apollo API integration** — Phase 3 dedup currently returns pass with a "Apollo not wired" note. The `users.apollo_api_key` column exists; the IPC handler exists; just needs the actual API call wired in `src/main/agent/gates.ts` `apolloDedupCheck`.
- **Conference/event-driven outreach** — out of scope per Rob's spec.
- **Email channel** — Apollo handles email; Rob explicitly wants this app for LinkedIn only.
- **T2 follow-ups** — Rob explicitly said no follow-ups.
- **electron-builder packaging dry-run** — `npm run dist` is configured but never executed end-to-end. First time you actually package, expect to fix one or two platform-specific gotchas.

## v2 LinkedIn skill — what's ported, what isn't

The BDR repo's `linkedin-connection-batch/SKILL.md` (locked Apr 30, 2026, committed May 3-4) is the canonical source for the LinkedIn connection-request workflow. **Read `SKILL_GAPS.md`** in this project — it's the precise log of what we've ported vs what's still pending. Highlights:

- **Ported:** locked formula + INC-022 readback, INC-023 pending pre-send check, INC-026 live-title capture, INC-027 strict aria-label match + post-click dialog verify, INC-028 daily-send-throttle (10 soft / 20 hard cap, surfaced in header banner), v2 hook quality framework (GREEN/YELLOW/RED tenure buckets) wired into the LLM prompt, auto-drop signals (Retired / Open to Work / Ex- / BPO-CX / banking-risk / claims-ops / software-dev-not-QA / sparse profile).
- **Not yet ported:** Sales Nav Rung 3 (Experience tab) + Rung 4 (`/details/experience/` subpage) capture, reply-check ladder for Gate 0 overrides, career arc check (claims-ops vs software lineage), real Apollo `/v1/people/match` (still stubbed), preload-URL + shadow-DOM `dispatchEvent` send pattern.

**Re-syncing from BDR after they update the skill:** there's a one-liner in `SKILL_GAPS.md` that copies the canonical files into `data/seed/{skills,playbooks}/`. The Playbook tab reads those files on every refresh, so updates show up in-app immediately.

## Non-obvious gotchas

1. **Schema is bundled inline.** `src/main/db/schema.sql` is imported as `?raw` by Vite. Editing the SQL requires rebuild (`npm run build`) for production but dev HMR reloads it automatically.
2. **better-sqlite3 needs Electron's Node ABI.** `npm install` runs `electron-builder install-app-deps` as a postinstall hook — that's the rebuild. If you swap Node versions or break the rebuild, run `npm run rebuild`.
3. **Playwright profile is in `userData`**, not the project. macOS: `~/Library/Application Support/LinkedIn Copilot/playwright-profile/1/`. Wipe it to force a re-login.
4. **Anthropic SDK reads the key from the DB** (`users.anthropic_api_key`) AND from `process.env.ANTHROPIC_API_KEY`. DB takes precedence. Useful for tests / scripts to override.
5. **Lowercase "its"** in the InMail opener is intentional voice (Rob's style). The QA D1 check enforces it via `requiredPhrases`. Don't "correct" to "it's".
6. **The locked connection-request formula has 0 question marks and 0 em dashes.** Both are enforced in D1 scoring. Hooks must be noun phrases (no terminal punctuation).
7. **DNC list is seeded from BDR/CLAUDE.md.** Re-extract via `node scripts/extract-dnc.mjs` if BDR adds new entries. The seed runs only on first install (idempotent).
8. **The runtime LinkedIn state** lives in `src/main/runtime-state.ts` — it's an in-memory module. The orchestrator updates it on capture success/failure. The header banner reads it via the `linkedin:status` IPC.
9. **Tests mock Electron + electron-log + better-sqlite3** in `tests/setup.ts`. Adding new tests that touch the DB? Either mock the specific calls in your test, or refactor the unit you're testing to be DB-free.
10. **The orchestrator picks the motion-specific path** at `src/main/agent/orchestrator.ts` line ~95. Connection request → `buildDraft` + `scoreDraft`. InMail → `runInMail` (separate function, separate D1 rules).
11. **Rob's branch is `claude/linkedin-sales-automation-DJK2c`.** Always develop there. The repo is `https://github.com/robertgorham-BDR/LinkedIn-Copilot-.git` (the trailing hyphen in the name is real).

## File layout cheat sheet

```
src/
  main/                                 # Electron main process
    index.ts                            # entry: init schema, seed, register IPC, launch window, start sync
    runtime-state.ts                    # in-memory LinkedIn state for the header banner
    db/{client,seed,schema.sql}         # SQLite plumbing
    browser/{session,linkedin}.ts       # Playwright + LinkedIn-specific selectors and send actions
    agent/                              # the brain
      orchestrator.ts                   # runs the full pipeline; emits events
      gates.ts                          # 0.5/0.6/0.7/0.7.5/1.5/3 functions
      research.ts                       # wraps capture + persists evidence
      drafting.ts                       # connect-request locked formula + dept heuristic
      inmail.ts                         # InMail 5-paragraph hero formula + D1 scoring
      qa.ts                             # connect-request D1 + delegates D2/D3 to llm.ts
      llm.ts                            # Anthropic SDK wrapper (Sonnet hook gen, Opus QA)
      sending.ts                        # dispatches to connection-request or InMail send
      sync.ts                           # reply-sync worker (invitations + inbox scan)
      analytics.ts                      # rollup queries
      demo-seeds.ts                     # 3 pre-baked prospects for rehearsal
    ipc/handlers.ts                     # ALL IPC routes
  preload/index.ts                      # contextBridge — exposes typed window.api
  renderer/                             # React UI
    App.tsx                             # sidebar shell + view router + global shortcuts
    components/{HeaderBanner,Toast,Onboarding,Shortcuts}.tsx
    pages/{Home,NewOutreach,Activity,Analytics,Playbook,Audit,Settings,OutreachDetail}.tsx
  shared/types.ts                       # cross-process types + IpcApi contract
data/seed/                              # bundled seed data (TAM, MASTER_SENT_LIST, DNC, G2, templates)
scripts/extract-dnc.mjs                 # one-shot DNC parser from BDR/CLAUDE.md
tests/                                  # Vitest deterministic tests
.github/workflows/ci.yml                # typecheck + test on every push
```

## How to make changes safely

1. **Always `npm run typecheck && npm test` after a change.** Both should be silent on success.
2. **For UI changes: `npm run dev`** and click around. Headless dev containers can't run Electron — needs a desktop with a display.
3. **For agent logic changes: write a Vitest first.** The deterministic gates + D1 scoring are easy to test (no LLM, no DB). Mock the DB in `tests/setup.ts` if you need it.
4. **Don't modify the BDR repo.** Sibling at `/home/user/BDR` (in this dev env) — read-only. The DNC list comes from there via `scripts/extract-dnc.mjs`. If BDR changes, re-run the script.
5. **Keep the locked formulas locked.** If you need to change the connection-request or InMail formula, update both the template file (`data/seed/templates/`) and the QA D1 constraints in `drafting.ts` / `inmail.ts`. There's no "almost-but-not-quite" — D1 enforces exact match.

## What Rob will likely ask for next

In rough order of likelihood:

1. **Fix the X selector that broke when LinkedIn updated their DOM.** Look at `src/main/browser/linkedin.ts`. Already has fallback chain (page title, og:tags); add more if needed.
2. **Sales Nav search keyword fallback isn't reliable.** The InMail send in `linkedin.ts` does a name-keyword search to find the lead page. If it fails, the right move is direct URN navigation: parse the Sales Nav lead URL pattern `/sales/lead/<URN>,*,<X>` and navigate there.
3. **Add Apollo API integration for real Phase 3 dedup.** Endpoint: `POST /v1/people/match` with `linkedin_url` or `email`. Field of interest: `contact.emailer_campaign_ids`. Empty array = clean.
4. **Add batch mode.** Rough sketch:
   - New "Batch" mode in `NewOutreach.tsx` source step.
   - Pick a TAM account → query Apollo people search filtered by ICP titles + that org_id → run Phase 2.5 LinkedIn pre-screen on the survivors → run full pipeline on each.
   - Show ranked list with confidence scores; user approves all that pass.
5. **Fix something that didn't render correctly on Windows / macOS.** Front-end CSS — not a known issue but Electron does have platform quirks.

## Current build sizes

- Main bundle: 70 KB
- Preload: 1.9 KB
- Renderer: 310 KB JS + 25 KB CSS

## Testing commands cheat sheet

```bash
npm run typecheck    # both tsconfigs (node + web)
npm test             # vitest run (35 tests, ~700ms)
npm run test:watch   # vitest watch
npm run lint         # eslint
npm run format       # prettier --write
npm run build        # production build
npm run dev          # launches Electron (needs a display)
npm run dist         # electron-builder, produces installers
```

## If you need to commit + push

The dev container's signing service has been intermittent. Rob has authorized either:

- waiting for it to recover and using `git commit` / `git push` normally, OR
- on his desktop, where signing isn't an issue, just `git push`.

Don't bypass signing in this dev env without his explicit say-so. Tarball + transfer is the safe path if signing is broken.

## Tone for the user

Rob's a busy BDR with monthly quota stress. He likes:

- Direct, concise responses (not big walls of text)
- Showing you understood the constraint before suggesting a change
- Visible progress over discussion
- Asking permission before destructive ops; otherwise execute

He explicitly said: "make sure that you make the best decisions" on the stack — so don't pepper him with low-stakes design questions. Make a call, document it (in this file or RUNBOOK), and ship. Things that DO require his input: anything that changes the locked formulas, anything that affects send behavior, anything visible to his coworkers, GitHub repo permissions.
