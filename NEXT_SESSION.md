# Next Session — Local Pickup Instructions

**You are the next Claude Code agent.** The previous 16 days were built in a remote dev container. You're now running locally on Rob's machine with full filesystem + browser + git access. This file gets you productive in <10 minutes.

> **Read FIRST (in this directory):** `CLAUDE.md` (scope boundary) → `PROJECT_CONTEXT.md` (mission + state) → `AGENTS.md` (protocol). Then return here for the boot runbook.

---

## 1. What this project is

**LinkedIn Copilot** — Electron desktop app that automates LinkedIn Sales Nav outreach end-to-end:
research → 8 BDR gates → draft against locked formulas → QA score → Playwright-driven send → reply lifecycle. Built for Rob Gorham (BDR @ Testsigma) for a hackathon demo on **May 6, 2026**.

**One-line architecture:** Electron 33 + Vite + React 18 + Tailwind (renderer) → typed IPC → Node main process → Playwright (persistent Chromium profile) + better-sqlite3 + Anthropic SDK (Sonnet 4.6 hooks, Opus 4.7 QA).

**Status as of Day 16:** MVP complete. 149/149 tests passing. Lint 0/0. Build silent. Smoke 22 pass / 3 skip. Single + bulk + auto-prospect flows ship. Both motions (Connect + InMail) wired with all v2 BDR gates.

---

## 2. Bootstrap (first 5 minutes)

```bash
# If you have the tarball:
mkdir ~/linkedin-copilot && cd ~/linkedin-copilot
tar -xzf ~/Downloads/linkedin-copilot-day16.tar.gz   # or wherever it landed

# OR clone from GitHub (once Rob has uploaded):
git clone https://github.com/robertgorham-BDR/LinkedIn-Copilot-.git
cd LinkedIn-Copilot-

# Install. The --legacy-peer-deps flag is REQUIRED (husky/lint-staged peer conflict).
npm install --legacy-peer-deps

# One-time Playwright Chromium download (~150 MB)
npx playwright install chromium

# Sanity check
npm test         # expect 149/149
npm run dev      # launches Electron app
```

If `npm test` fails with `better-sqlite3` ABI errors: `npm rebuild better-sqlite3`.

---

## 3. What just shipped (Day 16) — v7 BDR skill wire-in

The bundled BDR skills under `data/seed/skills/` were re-synced from the BDR repo (`origin/main 26806de`) on Day 15. Day 16 wired 5 v7 rules into app code. **Read `CHANGELOG.md` Day 16 first** — it's the source of truth.

| Phase | What | Where |
|-------|------|-------|
| A | Rung 4 restricted-page handling | `src/main/browser/linkedin.ts` → `capturePublicProfile` |
| B | Rung 3 freshness gate (<24h evidence pre-send) | `src/main/agent/sending.ts` → `approveAndSend` |
| C | 4-profile control sampling (vs single-probe) | `src/main/browser/linkedin.ts` → `controlProfileCheck` |
| D | Phase 9.0.5 7-day cooldown timer | migration `007_app_state.sql`, Health page, Settings clear-cooldown button |
| E | Phase 9.6 end-of-session reconciliation | Analytics page button, `reconcile:run` IPC |

---

## 4. Outstanding v7 gaps (still ❌)

Documented in `SKILL_GAPS.md`. Pick one if Rob asks "what's next":

1. **Phase 9.4 MASTER_SENT_LIST.csv append** — every successful send must append a row to the BDR repo's `MASTER_SENT_LIST.csv`. Cross-repo coupling — design tradeoff: shell out to a configured path? push to GitHub via API? File-watcher? Discuss with Rob before implementing.
2. **Gate 0.7 Gmail integration** — pre-send check that prospect has no existing Gmail thread with Rob. ~4h+ lift (OAuth, Gmail API, dedup logic).
3. **Sales Nav right-panel capture** — new "lead panel" data motion separate from full profile. Spec'd in `data/seed/playbooks/sales-nav-data-fetch.md`.

---

## 5. Critical operating rules (DO NOT VIOLATE)

These are encoded in code + tests. Don't loosen them without Rob's explicit approval.

- **INC-022 readback**: every send extracts → injects → reads back → char-for-char compares against the tracker source. Mismatch = halt. Tests in `tests/wrong-company.test.ts`.
- **INC-027 strict aria-label**: connect button match is `Invite ${expectedFullName} to connect` — exact, no fuzzy match.
- **INC-028 throttle**: hard caps 10/day, 20 weekly avg, 80/100 over 7 days. Cooldown auto-fires.
- **INC-030 stop-loss**: max 1 retry per failed InMail send → auto-DNC → continue. Never burn >2 credits on one prospect.
- **Locked connection-request formula** (BDR INC-022 v1): immutable. D1-enforced in `src/main/agent/drafting.ts`. Tests in `tests/drafting.test.ts`.
- **Tier B is BANNED** in v7. Only Tier A / A+ / A++ ship.
- **Phase 9.0 control sampling**: 4-profile probe before any send batch. If Connect button missing across all 4 → session likely flagged → halt + alert.
- **Career-arc detection**: claims-ops, banking-compliance, hardware-defense, clinical-pharma → auto-DNC at the gate. Tests in `tests/career-arc.test.ts`.

Full list: `data/seed/skills/linkedin-connection-batch.md` (971 lines, v7) and `data/seed/skills/inmail-batch-v2.md` (1355 lines, v3.2).

---

## 6. Project map (what to read when)

| You need to... | Read |
|---|---|
| Understand the daily workflow | `README.md` (has Mermaid diagrams) |
| See what changed each day | `CHANGELOG.md` |
| Understand a specific BDR rule | `data/seed/skills/{linkedin-connection-batch,inmail-batch-v2}.md` |
| Debug an operational issue | `TROUBLESHOOTING.md` |
| Set up the desktop binary | `RUNBOOK.md` |
| Understand an architecture choice | `docs/adrs/000{1,2,3,4}-*.md` |
| Audit BDR skill alignment | `SKILL_GAPS.md` |
| Hand off to a future agent | `HANDOFF.md` (the in-project one) |
| See the IPC contract | `src/shared/types.ts` + `src/preload/index.ts` |
| Modify a gate | `src/main/agent/gates.ts` |
| Modify the send flow | `src/main/agent/sending.ts` + `src/main/agent/sendQueue.ts` |
| Modify Playwright behavior | `src/main/browser/{session,linkedin,watchdog}.ts` |
| Add a migration | new `src/main/db/migrations/00N_*.sql` + register in `migrate.ts` (test enforces sequential numbering) |

---

## 7. Common dev commands

```bash
npm run dev              # Electron in dev mode (Vite HMR)
npm test                 # Vitest, 149 tests
npm test -- --watch      # Vitest watch mode
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm run build            # production build to out/
npm run package          # electron-builder → out/linux-unpacked (299 MB)
node scripts/smoke.mjs   # 22 health checks, 3 skipped (DB needs Electron ABI)
```

---

## 8. Gotchas / lessons from prior sessions

- **`better-sqlite3` is built for Electron's Node ABI.** Plain Node can't load it. Smoke test gracefully skips DB checks; tests that need DB use the electron-vite test setup.
- **Schema bundling**: `schema.sql` and other SQL files use Vite's `?raw` import. If you add a new migration, follow the existing pattern in `src/main/db/migrate.ts`.
- **PostCSS / Tailwind configs are `.mjs`** to avoid ESM warnings. Don't rename them to `.js`.
- **Apollo provider abstraction**: 4 modes (`api` / `ui` / `none` / `auto`). Settings page picks. UI mode drives `app.apollo.io` via Playwright when no API key. See `src/main/agent/apollo.ts`.
- **Sales Nav vs LinkedIn sessions are independent.** Either can expire. `runtime-state.ts` tracks both. Re-auth prompts surface in the Header banner.
- **Reply classifier ordering matters**: P4 hostile → P3 OOO → P2 decline → P0 warm. "Not interested" must hit P2 before "interested" hits P0. Test in `tests/reply-classifier.test.ts`.
- **The `data/seed/` BDR docs are the source of truth for the BDR rules.** Don't paraphrase them in code — quote the relevant section in a comment if a code rule needs justification.
- **No GPG signing in the prior dev container.** That constraint is gone locally — sign commits normally.

---

## 9. The transfer

The bundled tarball excludes `node_modules/`, `out/`, `dist/`, `coverage/`, `data/userdata/`, `.git/` — all regenerable or session-local.

To push to `https://github.com/robertgorham-BDR/LinkedIn-Copilot-`:

```bash
cd ~/linkedin-copilot
git init
git branch -M main
git remote add origin https://github.com/robertgorham-BDR/LinkedIn-Copilot-.git
git add -A
git commit -m "Initial commit: LinkedIn Copilot MVP (Days 1-16)"
git push -u origin main
```

---

## 10. First-session priorities (in order)

1. **Boot the app locally** (`npm run dev`) and walk through the Onboarding flow end-to-end with Rob's actual Anthropic + (optional) Apollo keys.
2. **Run a single-prospect dry-run** against a real Sales Nav profile. Don't send — stop at the readback. Confirm the gate output looks sane.
3. **Run `node scripts/smoke.mjs`** locally — should hit 25/0/0 (the 3 prior "skipped" pass when run inside Electron's ABI; if running plain Node, expect the original 22/0/3).
4. **Ask Rob what to tackle first**: one of the 3 SKILL_GAPS items, or a polish pass for the May 6 demo.

---

## 11. Demo deadline reminder

**May 6, 2026.** Today is May 5. The MVP works. Resist scope creep. If something feels broken, fix it. If something feels missing, ask Rob before building.

Good luck.
