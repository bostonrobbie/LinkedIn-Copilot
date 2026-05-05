# AGENTS.md — LinkedIn Copilot (scoped)

**Agent protocol for working on the LinkedIn Copilot Electron app.**

This file is parallel to (not a replacement for) the `AGENTS.md` at the BDR repo root. The root one governs Rob's BDR sales-ops work. **This one governs only the `linkedin-copilot/` subdirectory.**

---

## Session start (every session, in order)

1. **Read `CLAUDE.md`** in this directory — establishes scope boundary
2. **Read `PROJECT_CONTEXT.md`** — mission, goals, current state
3. **Read `NEXT_SESSION.md`** — boot runbook
4. **Read the latest `CHANGELOG.md` entry** — what shipped most recently
5. **Read `SKILL_GAPS.md`** — what's pending
6. Ask Rob what to work on

If you're picking up mid-task: also read `HANDOFF.md`.

---

## Scope boundary (hard)

- ✅ All work happens in `linkedin-copilot/`
- ✅ Reading `data/seed/` is fine — that's the bundled BDR source-of-truth
- ✅ Reading `docs/adrs/` is fine — architecture context
- ❌ Do not read or modify files at `../` (the parent BDR repo)
- ❌ Do not pull BDR ops files (memory/, batches/, MASTER_SENT_LIST.csv at root, etc.) into the app
- ❌ Do not commit changes outside `linkedin-copilot/`

If a task requires touching the parent repo, **stop and ask Rob.**

---

## Commit protocol

- Branch: `claude/linkedin-sales-automation-DJK2c` for the main thread of work, OR a new `claude/<topic>` branch if you're working on something distinct
- Commit message format: short imperative title + bullet body explaining WHY, not WHAT
- Sign commits when signing infra works
- If the dev-container signing server returns 400 (known intermittent issue from prior sessions), ask Rob explicitly before using `--no-gpg-sign`
- Open PRs as **draft** by default; let Rob mark ready-for-review

---

## Test-first guarantee

Every behavior change must come with a test update or a new test. Specifically:

- Locked-formula changes → update `tests/drafting.test.ts`
- Gate logic changes → update `tests/gates.test.ts`
- Send-safety changes → update `tests/wrong-company.test.ts`, `tests/send-queue.test.ts`, etc.
- Migration additions → migration test enforces sequential numbering automatically
- Reply classifier changes → update `tests/reply-classifier.test.ts`

Before any commit, run `npm test` locally. CI runs the same suite.

---

## Anti-patterns from prior sessions (don't repeat)

| Anti-pattern | What happened | Lesson |
|---|---|---|
| Loosening a locked formula because the test failed | Rob's locked Connect-request formula is INC-022-derived — immutable | Update the formula registry, not the test |
| Adding a "fallback" path to the send loop | Created an unintended bypass of INC-022 readback | Send loop has exactly one path — no fallbacks |
| Refactoring `agent/` into smaller files unprompted | Rob said "no refactors I didn't ask for" | Resist scope creep |
| Adding comments explaining the code | Names already explain it | Only comment WHY (non-obvious constraint) |
| Swapping `Sonnet 4.6` for a different model "for cost" | ADR-0003 locks the split | Don't change model IDs without an ADR update |

---

## Voice in code

- No emojis in code, comments, or docs (unless Rob explicitly asks)
- No flowery language in commit messages
- No "TODO" comments — open an issue or update SKILL_GAPS.md
- No `console.log` left in main process code (use the structured logger)

---

## Working with Rob

- He is the human-in-the-loop. Don't auto-approve sends, even in code. Drafts always surface to him before send.
- He prefers tight responses over verbose ones. State results, not deliberation.
- He'll say "go" or "proceed" when he wants you to execute. Otherwise, ask first.
- **Demo target May 6, 2026.** Polish > new features.

---

## When something breaks

1. Read the test output / smoke output first
2. Read the relevant file (don't guess)
3. Fix the root cause, not the symptom
4. Update the test if behavior is supposed to change
5. Run full suite before committing
6. If you can't fix in 30 min, surface to Rob with what you tried

---

## Subagents

If you're spinning subagents for parallel work:

- Subagents may read files inside `linkedin-copilot/`
- Subagents may NOT read the parent BDR repo
- Subagents may NOT make Apollo or LinkedIn calls (those happen via the app's runtime in dev mode)
- Verify subagent outputs before committing — they may fabricate when uncertain

---

## End of session

Update `CHANGELOG.md` with what shipped today. Append, don't rewrite. Keep one paragraph per session, dated. If you opened a PR, link it.

If you uncovered new gaps, append to `SKILL_GAPS.md`. If you re-synced bundled BDR data, note the source commit SHA.
