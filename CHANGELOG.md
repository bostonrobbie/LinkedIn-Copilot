# Changelog

## Day 16 — May 5, 2026 (v7 BDR skill rules ported into app code)

Day 15 brought the v7 skill text into the app's bundled docs. This pass implements 5 of the v7 rules in actual app behavior, closing the partials and three of the gaps identified in `SKILL_GAPS.md`.

### Added

#### Migration 007 — `app_state` key/value table
Persists cross-session timers + flags: INC-028 cooldown timestamp, last-reconciliation timestamp, future end-of-session markers.

#### Phase A — Rung 4 restricted-page explicit handling
`capturePublicProfile` now detects when `/details/experience/` is restricted (non-1st-degree → redirected back to public profile, or "not available" error page). Stores `RESTRICTED: ...` marker in `evidence.experience_subpage` instead of failing silently. Career-arc analysis already handles missing/marker subpage gracefully.

#### Phase B — Rung 3 freshness gate
Pre-send: read the evidence row's `captured_at`. If >24h before now AND no `overrideSoftCap`, abort with: `Gate 7 freshness: evidence captured 27.3h ago (>24h). Re-run the pipeline to refresh, or pass overrideSoftCap to bypass (not recommended — INC-026 risk).` Per v7 BDR skill ("Refresh Rung 3 within 24h of every send", locked Apr 30).

#### Phase C — 4-profile control sampling (Phase 9.0)
`controlProfileCheck(userId, candidateUrls)` now accepts a list of candidate URLs and probes up to 4. Early-exits on first Connect-visible (no rate-limit). On 0/N Connect AND 1+/N Follow: returns clear "Connect missing across 4/4 probed profiles" message. Pre-resume call site builds the sample from `[currentProspectUrl, ...top3DraftUrls]`. Falls back to Bill Gates when no candidates are queued.

#### Phase D — Phase 9.0.5 rate-limit cooldown
When the control probe confirms rate-limit (4/4 absent), `app_state` row `inc028_cooldown_until` is set to `now + 7d` with metadata. Subsequent send attempts read the cooldown first and abort with hours-remaining message until it expires. New IPCs `cooldown:get` and `cooldown:clear`. Health page surfaces the cooldown status as a 12th preflight check (red when active). Settings → Advanced has a "Clear cooldown" control with confirm prompt for false-positive recovery.

#### Phase E — Phase 9.6 end-of-session reconciliation
New IPC `reconcile:run` returns: today-by-motion-and-status counts, drafts pending, today's drops by reason, send-queue snapshot (queued / running / done-today / exhausted), cooldown state, 7-day rolling totals + cap utilization. `reconcile:lastRun` returns the last reconciliation timestamp. Analytics page has a "Run end-of-session reconciliation" button that renders the full report inline (4-stat header + by-motion-and-status + drops-by-reason + queue snapshot + 7-day totals).

### Changed
- `app_state` is now the cross-session state store. All cooldown / reconciliation timestamps land here.
- Health page: 12 preflight checks (was 11) — added `inc028-cooldown`.
- Settings → Advanced: new "INC-028 cooldown" card.

### Tests added (+1, total 149)
- `tests/migrations.test.ts` (+1) — 007_app_state landmark.

### Stats
- **149 Vitest tests** (+1) passing in 1.5s
- 22 smoke checks
- 7 schema migrations registered
- Renderer: 456 KB JS + 34 KB CSS (+10 KB from reconciliation report + cooldown controls)
- Main: ~165 KB
- 0 lint errors, 0 warnings; typecheck silent; build silent

### Remaining v7 gaps (still ❌)
- Phase 9.4 — MASTER_SENT_LIST.csv append per send (cross-repo coupling, design tradeoff)
- Gate 0.7 — Gmail Sent + received prior-email search (requires Gmail OAuth integration, larger lift)
- Sales Nav right-panel capture (Strategic Priorities + Shared Posts) — new Playwright capture, deferred

All documented in `SKILL_GAPS.md`.

## Day 15 — May 5, 2026 (BDR skill refresh — synced to origin/main `26806de`)

Pulled the latest BDR repo updates and refreshed the bundled skills + playbooks. The connection-batch skill jumped from v2 (549 lines) to v7 (971 lines) — major Apr 30 evening + May 1 morning lock additions including a "Send-Time Extreme Care Protocol" with new Phases 9.0–9.6.

### Updated bundled docs (no code changes — these are reference-only)

| File | Before | After |
| --- | --- | --- |
| `data/seed/skills/linkedin-connection-batch.md` | v2, 549 lines | **v7, 971 lines** |
| `data/seed/skills/inmail-batch-v2.md` | not bundled | **v3.2, 1355 lines (NEW)** |
| `data/seed/playbooks/inmail-batch-process-v2.md` | 415 lines | **520 lines** (refreshed) |
| `data/seed/playbooks/sales-nav-data-fetch.md` | not bundled | **147 lines (NEW)** |
| `data/seed/playbooks/linkedin-batch-quality-gate.md` | (refreshed pass) | unchanged in this commit |
| `data/seed/playbooks/linkedin-send-preflight.md` | (refreshed pass) | unchanged in this commit |
| `data/seed/dnc.json` | 74 entries | 74 entries (re-extracted from origin/main CLAUDE.md; no new DNC rows) |

### What's new in v7

- **NEW Phase 9.0**: pre-session rate-limit detection via control-profile probe. v7 specifies sampling 4 candidates from the send-ready file before any send attempt.
- **NEW Phase 9.0.5**: rate-limit halt decision tree when 4-of-4 sample fails.
- **NEW Phase 9.1–9.6**: per-send preflight checklist, char-for-char readback spec, post-click dialog verification, MASTER append, in-session cap watch, end-of-session reconciliation — all formalized.
- **NEW Gate 0.5**: Apollo `emailer_campaign_ids` check (Factor-First auto-enroll detection).
- **NEW Gate 0.7**: Gmail Sent + received prior-email search (mandatory per candidate).
- **MANDATORY**: Sales Nav right-panel capture, recent activity capture, About-section verbatim quote.
- **Tier B BANNED** — only A / A+ / A++ allowed in the locked formula.
- **/details/experience/ subpage restricted for non-1st-degree** — confirmed Apr 30.
- **Refresh Rung 3 within 24h of every send** — Gate 7 freshness escalated.

### App vs v7 — alignment

The Playbook tab in the app now renders the v7 skill verbatim. `SKILL_GAPS.md` updated with a v7-deltas matrix showing where the app aligns (✅), partially aligns (⚠), or has a gap (❌).

**App is aligned on:** Phase 9.1 / 9.2 (INC-022 readback) / 9.3 (INC-027 dialog verify) / 9.5 (INC-028 throttle), Gate 0.5 (Apollo dedup), MANDATORY recent activity + about, Tier classification, headline-vs-Experience preference.

**App is partially aligned on:** Phase 9.0 (single control profile vs v7's 4-profile sample), /details/experience/ restricted-page handling (we catch silently), Rung 3 freshness (no gate enforcing <24h).

**App has gaps on:** Phase 9.0.5 (rate-limit halt tree), Phase 9.4 (MASTER_SENT_LIST.csv append per send — we keep our own `outreach` table), Phase 9.6 (end-of-session reconciliation), Gate 0.7 (Gmail integration), Sales Nav right-panel capture.

All gaps documented in `SKILL_GAPS.md` with rationale.

### How re-sync works

The Playbook page reads from `data/seed/{skills,playbooks}/` at runtime via the `skills:list` IPC. New docs surface automatically; no code change is needed when bundling.

To resync after future BDR updates:

```bash
cd /home/user/BDR && git fetch origin
git -C /home/user/BDR show origin/main:skills/linkedin-connection-batch/SKILL.md > data/seed/skills/linkedin-connection-batch.md
git -C /home/user/BDR show origin/main:skills/inmail-batch-v2/SKILL.md > data/seed/skills/inmail-batch-v2.md
git -C /home/user/BDR show origin/main:memory/playbooks/sales-nav-data-fetch.md > data/seed/playbooks/sales-nav-data-fetch.md
git -C /home/user/BDR show origin/main:memory/playbooks/inmail-batch-process-v2.md > data/seed/playbooks/inmail-batch-process-v2.md
git -C /home/user/BDR show origin/main:CLAUDE.md > /tmp/claude.md && node scripts/extract-dnc.mjs /tmp/claude.md
```

### Stats
- **148 Vitest tests** still passing (no test changes — pure doc refresh)
- 22 smoke checks
- 6 schema migrations
- Renderer unchanged
- Main unchanged
- Bundled doc total: 3763 lines (was ~2200 — +1500 lines of v7 + new files)
- 0 lint errors, 0 warnings; typecheck silent; build silent

## Day 14 — May 5, 2026 (Apollo employment parsing for prior-tenure detection)

Surfacing the Apollo employment data we already capture into structured insights the orchestrator can reason over. No new features — deeper use of existing data.

### Added

- **`agent/apolloEmployment.ts`** — parser for `prospects.apollo_employment` JSON. Returns:
  - `tenureCurrentRoleMonths` — precise months in the current role (replaces the headline regex heuristic)
  - `tenureCurrentEmployerMonths` — continuous months at the current employer across role hops (computed from earliest start_date at that employer to current end_date)
  - `careerGrownInternal` — `{ detected, employer, rolesCount, yearsAtEmployer }`. Triggers when ≥8 years at one company across ≥2 distinct titles. Aleksandar Sysdig pattern (SWE → EM → Sr EM → Director).
  - `jobHopper` — `{ detected, employersInLast5Years }`. Triggers when ≥4 distinct employers started in the last 5 years.
  - `prevEmployers`, `uniqueEmployers`, `currentEmployer`, `currentTitle`, `rolesAtCurrentEmployer`, `totalExperienceMonths`.
  - Lenient date parsing (`2018-03-15` / `2018-03` / `2018` all work).
  - Employer normalization (strips `Inc.`, `Corp`, `LLC`, `Ltd`, `GmbH` so "Microsoft Corp" + "Microsoft" are treated as the same employer).
- **Wired into `analyzeCareerArc`** as the preferred career-grown-internal signal source — high confidence when Apollo employment confirms it. The previous regex-over-text fallback only fires when Apollo data isn't available.
- **New `job-hopper` signal** in career-arc detection — informational only, doesn't cause a drop. Surfaces in the gate log so the rep can choose to skip.
- **Wired into the orchestrator's drafting** — `effectiveTenure = apolloInsights.tenureCurrentRoleMonths ?? research.tenureInCurrentRoleMonths`. The LLM hook generator now gets precise tenure data when available, which feeds the GREEN/YELLOW/RED tier decision in the locked formula.

### Tests added (+15, total 148)

- `tests/apollo-employment.test.ts`: empty input handling, Aleksandar Sysdig career-grown pattern (4 roles spanning 9 years), job-hopper detection (4 employers in 5 years vs 3 employers fine), tenure math (single role + continuous-across-hops), year-only date handling, malformed dates, employer normalization (Microsoft Corp = Microsoft), prev-employers list, JSON parse safety.

### Stats

- **148 Vitest tests** (+15) passing in 1.5s
- 22 smoke checks
- 6 schema migrations
- Renderer unchanged (main-process work only)
- Main: ~155 KB (+5 KB)
- 0 lint errors, 0 warnings; typecheck silent; build silent

## Day 13 — May 5, 2026 (Day 12 follow-on polish — items 1-5)

Five tight follow-on items from the Day 12 backlog. All under 30 minutes each, none new features.

### Added

- **Override audit trail rendered on OutreachDetail** — under the reply card, an `<details>` collapsed by default ("Override history (N)") reveals every classification change with timestamp, source pill (manual / reclassify / bulk), prior → new diff, and reason. Pulls from the `classification_overrides` table populated in Day 12.
- **Override-with-reason on bulk path** — bulk-classify now prompts for an optional reason (same UX as the single-row override). Reason carried into the audit row with `source = 'bulk'`.
- **Bulk select keyboard shortcuts in Activity** — `Cmd+A` selects all rows visible after the current filter + search. `Esc` clears the selection (only fires when nothing is selected → no-op; non-input focus only).
- **Drop-rate alert action button** — the red "Drop rate is too high" banner on Home now has a "Re-source" button that jumps directly to New Outreach so the rep can switch accounts / broaden titles instead of just reading the alert.
- **Apollo employment date formatting** — career history dates now render as "Mar 2018 → Aug 2021" instead of the raw "2018-03 → 2021-08". Year-only dates fall back to year alone.

### Stats
- 133 Vitest tests still passing (no test churn)
- 22 smoke checks
- Renderer: 446 KB JS + 34 KB CSS (+4 KB)
- 0 lint errors, 0 warnings; typecheck silent; build silent

## Day 12 — May 4, 2026 (deeper quality pass — visibility + audit + bulk ops)

Continuing the "no new features, polish what exists" pass. Surfaces existing data that was hidden, adds bulk operations on existing rows, and starts capturing audit trails for classifier overrides. 123 → 133 tests.

### Added

#### Phase A — Apollo enrichment panel on OutreachDetail
- New `ApolloEnrichmentPanel` renders `apollo_company`, `apollo_title`, and full `apollo_employment` career history (sorted: current first, then by start_date desc).
- Side-by-side comparison: when Apollo employer/title differs from LinkedIn capture, a yellow ⚠ note explains it (Phase 1.5b drops on company mismatch; title-discrepancy is informational).
- Each role row shows organization, title, date range, "current" pill where applicable.
- IPC `outreach:detail` already had the data captured in the prospect row; this just surfaces it.

#### Phase B — Bulk operations in Activity
- Per-row checkboxes + select-all on visible rows.
- Floating action bar appears above the table when ≥1 row is selected:
  - 5 classification override pills (P0 / P1 / P2 / P3 / P4) — bulk-applies in one transaction
  - "Reverse auto-DNC" — bulk-removes auto-DNC entries tied to selected rows
  - "Clear selection"
- New IPCs: `reply:setClassificationBulk`, `dnc:reverseAutoBulk`. Both take an array of outreach IDs and run a single SQLite transaction.

#### Phase C — Classification override audit trail
- New migration `006_classification_overrides.sql` adds the `classification_overrides` table (id, outreach_id, user_id, prior_value, new_value, reason, source ∈ {manual, reclassify, bulk}, ts).
- `reply:setClassification` and `reply:setClassificationBulk` now read the prior value, write an audit row when it changes, and tag the row with `source = 'manual' | 'bulk'`.
- OutreachDetail prompts the user for an optional reason on manual override (saved to `reason` column).
- New IPC `reply:listOverrides(outreachId)` returns the per-prospect override history.

#### Phase D — Drop-rate health signal in Today's Actions
- `analytics.buildTodaysActions` now returns `dropRate24h: { drafted, dropped, rate, severity }`.
- Severity logic: `ok` if drafted < 5 (not enough data), `warn` if rate > 20%, `alert` if rate > 50%.
- Home renders a red alert banner at >50% drop rate ("the source pool is bad — re-source rather than push through" — straight from the v2 BDR skill).
- Yellow banner at 20-50% drop rate.

#### Phase E — Tests (+10, total 133)
- `tests/send-queue.test.ts` (8) — INC-030 burn detection regex parity (matches credit/burned/no-thread/body-readback/send-timeout, doesn't match unrelated errors). Backoff schedule monotonicity + bounds + total-window math.
- `tests/migrations.test.ts` (+1) — 006 migration shape.

### Why these specifically

You said "polish what exists" — so I audited every existing feature for "what data is captured but not surfaced" / "what's a one-row-only operation that should be bulk":

- **Apollo employment** was captured by the `/v1/people/match` integration (Day 10) and used by Phase 1.5b internally, but the rep had no way to see it. Surfacing it gives the rep the "why was this dropped?" context inline.
- **Classifier override** was per-row only. Reps triaging 20+ replies would do 20+ clicks. Bulk ops collapse that to 2 clicks (select + classify).
- **Override audit trail** existed conceptually (we know classifications change) but never recorded. Now we have the data to analyze classifier accuracy over time.
- **Drop-rate signal** existed in preflight (informational only). Surfacing in Today's Actions when it's actually a problem makes it actionable.

### Stats
- **133 Vitest tests** (+10) passing in 2.4s
- 22 smoke checks (3 skipped on bare Node)
- 6 schema migrations registered (added `006_classification_overrides`)
- Renderer: 442 KB JS + 33 KB CSS (+10 KB from Apollo panel + bulk action bar + drop-rate alert)
- Main: ~150 KB
- 0 lint errors, 0 warnings; typecheck silent; build silent

## Day 11 — May 4, 2026 (quality pass on existing features — no new features)

User asked to "make existing features as high quality as possible." This pass closes visible gaps in features we already shipped: send queue had no UI, key health was opaque, classifier overrides were missing, bulk URL handling was naive, restore required manual reload. 100 → 123 tests.

### Added

#### Phase A — Send Queue visibility + retry actions
- New **Send Queue** sidebar tab (`Cmd+4`) with status filter pills (queued / running / exhausted / done / cancelled), per-row attempt counters, last error, next-retry timestamp.
- Per-row **"Retry now"** button — bypasses the backoff and re-queues immediately.
- Per-row **"Cancel"** button — marks the queue row cancelled.
- New IPC: `queue:retryNow`, `queue:requeueOutreach`. `listQueue` join-extended to include prospect name + company + motion so the UI doesn't need a separate lookup per row.
- New **"Re-queue send"** button on OutreachDetail when status=`failed` — manually re-enqueues a permanently-failed row.

#### Phase B — API key health validation
- New `health/keyChecks.ts`: `checkAnthropicKey` (cheap `/v1/messages` 1-token probe with model `claude-haiku-4-5-20251001`) and `checkApolloKey` (`/v1/auth/health` GET).
- Returns structured `{ ok, status: 'valid' | 'invalid' | 'rate-limited' | 'network-error' | 'not-configured', detail, httpStatus }`.
- Settings → API keys → **inline "Check key health"** button next to each configured key. Status pill (valid / invalid / rate-limited / network-error) with detail tooltip.
- New `Show / Hide` toggle on key inputs.

#### Phase C — Reply lifecycle polish
- **"Re-run classifier"** button on the OutreachDetail reply card — triggers `classifyAndPersist` again (useful when classifier was wrong or new context arrives).
- **Manual classification override** — 5 pill buttons (P0/P1/P2/P3/P4) below the reply, click to override stored classification.
- **"Reverse auto-DNC"** button when an auto-DNC entry is tied to the outreach (only auto-added rows can be reversed; manual DNC stays locked).
- New IPCs: `reply:reclassify`, `reply:setClassification`, `dnc:reverseAuto`, `dnc:listAutoForOutreach`.

#### Phase D — Pipeline + bulk polish
- New `shared/url.ts` — `normalizeLinkedInUrl(input)` and `normalizeBulkUrls(text)`. Handles: angle brackets, query strings, mixed case, URL-encoded slugs, Sales Nav `/sales/lead/<URN>` (rejected with hint), `/pub/` legacy URLs (rejected with hint), de-dup across whitespace + casing.
- Bulk-paste preview now shows `N valid · M duplicates removed · K invalid` with expandable invalid-line list (line + reason).
- Backup restore now **auto-reloads the renderer** 800ms after success — no more "DB inconsistent until manual reload" footgun.

#### Phase E — Test coverage
- `tests/url-normalization.test.ts` (12) — vanilla profile, query stripping, lowercase, angle brackets, URL encoding, Sales Nav rejection, /pub/ rejection, garbage rejection; bulk: dedup across casing, invalid lines with reasons, realistic mixed paste.
- `tests/key-checks.test.ts` (11) — Anthropic: not-configured, valid 200, invalid 401 with body parse, rate-limited 429, network error; Apollo: not-configured, valid (is_logged_in true), invalid (is_logged_in false), 401/403, network error.

#### Phase F — Documentation
- New `TROUBLESHOOTING.md` — 6-section operational runbook: Health page checks, recent log, common failure modes (research/INC-028/wrong-company/career-arc/control-profile/INC-030/hostile reply/send queue stuck/bulk paste empty/blank window), reset escalation order, bug reporting, dev gotchas.
- `SKILL_GAPS.md` refreshed for Day 11 — 16 items now ✅, 7 still pending. Each gap has a status (✅ shipped Day N or ❌ pending) and the lift estimate.

### Stats
- **123 Vitest tests** (+23) passing in 2.5s
- 22 smoke checks (3 skipped on bare Node)
- 5 schema migrations
- Renderer: 432 KB JS + 32 KB CSS (+18 KB from SendQueue + reply card overrides + key health UI)
- Main: ~145 KB (+10 KB from key checks + queue helpers)
- 0 lint errors, 0 warnings; typecheck silent; build silent
- Sidebar: 10 nav items now (added Send Queue)

## Day 10 — May 4, 2026 (real Apollo + auto-prospect-enroll + research-depth gates)

The "now it's actually a tool" pass. Real Apollo API replaces the stub. Career-arc detection from Rung 4 fires. Slug preflight catches dead URLs. INC-028 throttle is now both daily AND weekly. Pre-resume control-profile check detects soft-blocks. Auto-prospect-enroll batch flow ships — pick a TAM account, Apollo sources ICP candidates, the existing pipeline runs on each.

### Added

#### Wave 1 — Foundation hardening

- **Real Apollo `/v1/people/match` API call** (`agent/apollo.ts` `ApolloApiProvider.match`).
  - Posts to `https://api.apollo.io/v1/people/match` with `linkedin_url` / `email` / `name` + `organization_name`.
  - Parses `contact.emailer_campaign_ids` → `inActiveCampaign` boolean (Factor-First auto-enroll detection).
  - Returns enrichment data: `_apolloCompany`, `_apolloTitle`, `_apolloEmployment` (JSON).
  - Exponential backoff (1s/2s/4s/8s) on 429 / 5xx / network. Returns clear errors on 401 (key invalid) and other HTTP failures.
- **Real Apollo `/v1/mixed_people/search`** (`ApolloApiProvider.search`). Used by the auto-prospect-enroll flow to source ICP candidates from a TAM account.
- **Apollo enrichment persisted to prospects table.** `apolloDedupCheck` now writes back `apollo_id`, `apollo_company`, `apollo_title`, `apollo_employment` so the wrong-company gate (1.5b) and career-arc detector can use the data.
- **Career-arc detection** (`agent/careerArc.ts`).
  - Pattern library: `claims-ops` (Marcela Fetters), `banking-compliance` (Sabrina Perry), `hardware-defense` (Brian Nysse / Kevin Kirkpatrick), `clinical-pharma` (Stephanie Reddick / Venkateshwarlu Gajjela).
  - Each pattern has 8–13 keyword indicators; ≥2 match = low confidence, ≥3 = medium, ≥4 = high.
  - Positive signal: `career-grown-internal` (8+ years at one company with progression — Aleksandar Sysdig pattern). Never causes a drop.
  - Hooked into orchestrator as Phase 4.5: runs after research, drops on medium+ confidence persona-mismatch with full evidence trail in gate_log.
- **Slug preflight on 404** (`browser/linkedin.ts` `capturePublicProfile`). When LinkedIn shows the "Page not found" / "Profile is not available" page, capture throws a clear actionable error: "hunt for a fresh slug or drop the candidate" (Vamsidhar pattern).
- **7-day rolling throttle** (`agent/sending.ts`).
  - New `weeklySendCount(userId, motion)` — counts sends in last 7 days.
  - Soft cap 80/7d, hard cap 100/7d. Both checked before the daily caps.
  - Daily 10 soft / 20 hard caps still enforced.
  - Weekly hard cap takes priority over daily (LinkedIn enforces ~100/7d).
- **Pre-resume control-profile check** (`browser/linkedin.ts` `controlProfileCheck` + `sending.ts`).
  - Triggered when ≥24h since last successful send.
  - Navigates to `linkedin.com/in/williamhgates/` and verifies the Connect button is visible.
  - If Connect missing AND Follow visible → INC-028 weekly-cap soft-block detected, abort send with clear error.

#### Wave 2 — Auto-prospect-enroll batch flow

- **`agent/autoProspect.ts`**: `sourceFromAccount` calls Apollo `/v1/mixed_people/search` filtered by ICP titles (default 13 titles covering QA Manager / Lead / Director / VP, SDET, Test Automation, QE, Software Eng Manager). Pre-screens each candidate against DNC + master_sent_list + app outreach. Returns a list of `ProspectCandidate` rows with `preScreen.pass + reasons`.
- **IPC**: `autoprospect:icpTitles`, `autoprospect:fromAccount`. Wired into preload + types.
- **Wizard "Batch from TAM account" mode**:
  - Mode picker now enables Batch (was disabled badge "Post-demo").
  - Source step shows account picker with filter + tier badges, "Source candidates" button, then a candidate list with name + title + selection state + pre-screen reasons.
  - Pre-screen-clean candidates are pre-selected; blocked rows render disabled with reasons.
  - "Run pipeline on N candidates" button kicks off the existing bulk pipeline runner — every candidate goes through the full single-prospect flow (research → all gates → drafting → QA → review).

### Changed

- `apolloDedupCheck` signature now accepts `prospectId` so it can write enrichment back to the prospect row.
- Orchestrator now passes `prospect_id` to Phase 3 dedup, then runs Phase 4.5 career-arc check using the freshly-enriched data.
- Orchestrator's Apollo enrichment fires once per pipeline (Phase 3) and is reused by Phase 4.5 — no duplicate API calls.
- Sending throttle messages now distinguish "daily soft" / "daily hard" / "weekly soft" / "weekly hard" so the user knows which window they're hitting.

### Tests added (+10, total 100)

- `tests/career-arc.test.ts` (9): no-op on empty input, claims-ops detection (Marcela), banking-compliance, hardware-defense, clinical-pharma, career-grown-internal positive signal, clean software-QA passes, `shouldDropOnCareerArc` blocking + non-blocking cases.
- `tests/migrations.test.ts` (+1): 005_mvp_completion landmark fields.

### Stats

- **100 Vitest tests** (+10) passing in 2.6s
- 22 smoke checks (3 skipped on bare Node)
- 5 schema migrations
- Renderer: 414 KB JS + 32 KB CSS (+8 KB from auto-prospect UI)
- Main: ~135 KB (+15 KB from real Apollo API + career-arc + auto-prospect)
- 0 lint errors, 0 warnings; typecheck silent; build silent

### What's still on the backlog

- Wire `auto_added_reason_kind = 'career_arc_drop'` into DNC when career-arc fires? Currently we just drop the outreach; we don't auto-DNC since career-arc detection is fuzzy. Worth re-evaluating after we have data on false-positive rate.
- Re-engagement workflow (manual draft + send back to a P1-engaged contact whose conversation went silent). Right now Today's Actions surfaces them; the rep manually opens LinkedIn to reply.
- `apollo_employment` is captured but the orchestrator only uses `apollo_company` for the wrong-company gate. Future work: parse `apollo_employment` for prior-tenure detection (Aleksandar pattern).

## Day 9 — May 4, 2026 (MVP completion: bulletproofing the end-to-end flow)

The "make it flawlessly end-to-end" pass. Reply lifecycle gets an actual classifier with auto-DNC. Phase 0.6 grows from one source to four. Wrong-company gate added. Patches re-trigger D2/D3 scoring. Tier shows up in the UI. INC-030 stop-loss caps InMail credit burns. Single-instance lock prevents DB races. Sales Nav Rung 4 capture lands. 90 tests passing.

### Added

#### Phase 1 — Bulletproofing the single-prospect flow
- **Migration 005** (`mvp_completion`) — adds: `prospects.apollo_company / apollo_title / apollo_employment` (for cross-check), `evidence.experience_subpage` (Rung 4), `outreach.reply_classification / reply_classified_at / tier`, `dnc.auto_added_from_outreach_id / auto_added_reason_kind` (audit trail for auto-DNC).
- **Reply-check ladder** — Phase 0.6 expanded from 1 source (prior_contacts) to 4: prior_contacts, dnc, this app's outreach history (any motion, any active status), and warm-engagement signal (accepts/replies in last 90d). Reports which source(s) matched on drop.
- **Wrong-company gate (1.5b)** — `wrongCompanyCheck(apolloCompany, linkedinCompany)`. Tolerant to corporate suffix differences (Inc/LLC/Corp/Ltd) and substring matches; drops on hard mismatch (Raj Parmar pattern: Apollo says Chase, LinkedIn shows Cardinal Health).
- **Patch-and-re-QA on edits** — `outreach:update` re-scores D1 deterministically AND re-runs D2/D3 against Anthropic when LLM is available. Returns `rescored: true/false` so the UI can show whether D2/D3 was just re-evaluated.
- **Tier classification** — drafting now classifies hook tier (A / A+ / A++) per the v2 BDR skill. Surfaced in OutreachDetail header next to confidence. Stored in `outreach.tier`.
- **INC-030 stop-loss** — InMail credit-charged-no-thread failures cap retries at 1 (vs 5 normal) and auto-DNC the candidate with audit trail (`auto_added_reason_kind = 'inc_030_burn'`).
- **Single-instance lock** — `app.requestSingleInstanceLock()`. Prevents two app processes from racing on SQLite migrations / seed loads. Second instance focuses the existing window instead of corrupting state.

#### Phase 2 — Reply lifecycle
- **Reply classifier** (`agent/replyClassifier.ts`) — Opus-driven P0-P4 classification (warm / engaged / decline / auto-reply / hostile). Zod-validated output. Heuristic fallback when no Anthropic key. Persists to `outreach.reply_classification` and `reply_classified_at`.
- **Auto-DNC on hostile** — classifier returns `should_dnc: true` for P4 hostile or unsubscribe → automatic insert into `dnc` table with audit (`auto_added_from_outreach_id`, `auto_added_reason_kind = 'hostile_reply'`). The Phase 0.6 ladder will catch the row on any future attempt.
- **Reply card on OutreachDetail** — when `status='replied'`, a color-coded card renders the verbatim reply, the classification pill, and a suggested response template (P0 → "send calendar link"; P1 → "reply within 4h"; P4 → "auto-DNC added, do NOT respond").
- **Warm-lead re-engagement scanner** — `analytics.buildTodaysActions` now returns `reEngagement` rows: accepts that haven't replied in 60+ days, OR P1 engaged replies that went silent for 30+ days. Surfaced in Home → Today's Actions as a purple action card.

#### Phase 3 — Research depth
- **Sales Nav Rung 4 capture** — `capturePublicProfile` now navigates to `https://www.linkedin.com/in/<slug>/details/experience/` after the main capture, scrolls to load lazy entries, captures up to 30 KB of verbatim long-form Experience text. Stored in `evidence.experience_subpage`. Per the Apr 30 BDR lock this is the floor for connection-request research depth on borderline candidates.

### Changed
- **Sync worker** now invokes `classifyAndPersist(userId, outreachId)` for every newly-replied row in the same tick. Hostile replies trigger auto-DNC inline.
- **Home → Today's Actions** has a new "ready to re-engage" section between drafts and recent drops.
- **OutreachDetail** header gains a hook-tier pill alongside confidence and status.
- **Phase 0.6 priorContactCheck** now takes `linkedinUrl` as an optional second arg so the app-history source can match by URL (more robust than name-only).

### Tests added (+13, total 90)
- `tests/wrong-company.test.ts` (7) — equality, suffix tolerance, substring tolerance, mismatch drops, null handling, case-insensitivity, real-world patterns (Raj Parmar, Satish Sivasubramanian).
- `tests/reply-classifier.test.ts` (6) — heuristic path: P0 warm patterns, P4 hostile + auto-DNC, P3 OOO, P2 polite decline, P1 fallback, shouldDnc only on hostile/unsubscribe.

### Stats
- **90 Vitest tests** (+13) passing in 1.5s
- 22 smoke checks (3 skipped on bare Node)
- 5 schema migrations registered
- Renderer: 406 KB JS + 32 KB CSS (+4 KB from reply card + tier pill + re-engagement card)
- Main: ~120 KB
- 0 lint errors, 0 warnings; typecheck silent; build silent

### Deferred (intentional, post-demo)
- Phase 1.7 (pre-resume control-profile check) — selector-fragile; needs live LinkedIn validation before landing.
- The Apollo `apollo_company` column is added but populated only when an Apollo enrichment call runs. Wiring `ApolloApiProvider.match` to actually populate it is Tier 5 work.

## Day 8 — May 4, 2026 (onboarding + Apollo provider abstraction + Settings redesign + backup depth)

The "make it smooth and error-free" pass. Five things changed shape: onboarding state, Sales Nav as a first-class session, Apollo with API-or-UI choice, Settings sectioned, backups self-healing.

### Added

#### Phase A — Sales Nav as an independent session
- `runtime-state.ts` now tracks `linkedin` and `salesnav` separately with their own `state` + `lastObservedAt`.
- New `isSalesNavLoggedIn(userId)` and `startSalesNavLogin(userId)` browser helpers (navigate to `/sales/home`, detect Sales Nav nav element, redirect to `/login` on logged-out).
- New IPCs `salesnav:status`, `salesnav:login`.
- Header banner shows both pills: `LinkedIn ✓` and `Sales Nav ✓` independently.
- Preflight gets a `salesnav-session` check separate from the LinkedIn one.

#### Phase B — Apollo provider abstraction
- New `agent/apollo.ts` with the `ApolloProvider` interface (`source`, `available`, `match`).
- Three concrete providers:
  - `ApolloApiProvider` — stub for `/v1/people/match` (Tier 5 to wire fully)
  - `ApolloUiProvider` — drives `app.apollo.io` via Playwright, watchdog-guarded
  - `NoopApolloProvider` — when off
- `getApolloMode()` resolves preference: `auto` (API if key set, else UI) | `api` | `ui` | `off`. Stored in `schema_meta` table.
- Phase 3 dedup gate (`apolloDedupCheck`) is now provider-driven and async; orchestrator awaits it. Drops on confirmed in-campaign signal, warns on errors, passes when clean.

#### Phase C — Onboarding v2 (DB-tracked)
- New migration `004_onboarding.sql` adds `onboarding_steps` table (per user_id × step_id, status pending/completed/skipped).
- New `src/main/onboarding.ts` with `getStepStates`, `setStepStatus`, `resetOnboarding`, `isOnboardingComplete`.
- Onboarding overlay rewritten as 8-step flow (welcome → linkedin → salesnav → anthropic → apollo → tam → demo → done) with:
  - Per-step status pills in the header strip
  - Free navigation between steps (click any step in the strip)
  - "Skip" + "Skip all" paths that record explicit `skipped` status
  - Apollo step has a 4-way mode picker (auto/api/ui/off) with live `resolved` indicator
  - Resumes from the first non-completed step on app reopen
- IPC `onboarding:state`, `onboarding:setStep`, `onboarding:reset`.

#### Phase D — Settings sectioned redesign
- Single-page Settings replaced by a 5-section layout (sidebar nav: Account / Sessions / Keys / Data / Advanced).
- **Account**: editable display name + email; "Re-run onboarding" button.
- **Sessions**: LinkedIn + Sales Nav with per-surface status pill, last-observed timestamp, login launcher.
- **Keys**: Anthropic + Apollo (encrypted at rest via safeStorage). Apollo includes the 4-way mode picker.
- **Data**: TAM re-import, demo seeds, full backups panel (create / restore / delete + open backups folder), folder paths (userData / backups / Playwright profile / logs) with one-click "Open" buttons (uses `shell.openPath`).
- **Advanced**: throttle reference, build info, factory-reset placeholder (typed-confirmation gate).
- New IPC: `folders:get`, `folders:open`, `user:update`, `apollo:getMode`, `apollo:setMode`.

#### Phase E — Backup depth
- `createBackup(label?)` — optional label suffix in filename; runs `PRAGMA integrity_check` on the snapshot before returning. Throws if integrity check fails.
- `restoreBackup` is now async and takes a pre-restore snapshot first (label `pre-restore`) so a bad backup can never silently lose current data.
- New `startAutoBackup(intervalHours = 24)` worker — first auto-backup 5 min after launch, then every 24h. Stopped on quit.
- IPC return type for `restoreBackup` exposes `preRestoreBackup` so the UI can tell the user where their pre-restore snapshot lives.

#### Phase F — ADRs + tests
- Four ADRs in `docs/adrs/`:
  - `0001-electron-vs-tauri.md` — why Electron despite the bigger binary
  - `0002-local-first.md` — why SQLite + multi-user-ready schema beats a server for the MVP
  - `0003-anthropic-model-split.md` — why Sonnet for hooks, Opus for QA
  - `0004-locked-formulas.md` — why the BDR templates are immutable code constants enforced by D1
- Tests +4: onboarding step manifest + 004 migration shape.

### Changed
- `src/main/agent/gates.ts`: `apolloDedupCheck` is now async and takes a candidate object instead of a single ID.
- Orchestrator awaits the new Apollo gate; emits drop event when in-campaign signal trips.
- `restoreBackup` always takes a pre-restore snapshot before swapping files. Even if the restore fails, the pre-restore snapshot is still on disk.

### Stats
- 77 Vitest tests (+4) passing in ~2.1s
- 22 smoke checks (3 skipped on bare Node)
- 4 schema migrations registered (v1 initial, v2 encrypted_keys, v3 send_queue, v4 onboarding)
- Renderer: 402 KB JS + 32 KB CSS (+31 KB from new Onboarding + Settings + Sales Nav pill)
- Main: ~110 KB; Preload: 4.2 KB
- 0 lint errors, 0 warnings; typecheck silent; build silent

## Day 7 — May 4, 2026 (Tier 3 production-readiness pass)

The codebase + infrastructure pass. Closing gaps that show up when you actually try to ship: untested packaging, plaintext keys, lost sends on crash, stuck Playwright pages, drift-prone codebase.

### Added

#### Tier 3.1 — Packaging verified end-to-end
- `npm run package` runs cleanly: produces `dist/linux-unpacked/` with the linkedin-copilot binary, 25 MB `app.asar`, full Electron + Chromium runtime (299 MB total).
- `extraResources` correctly bundles `data/seed/` (TAM, DNC, MASTER_SENT_LIST, skills, playbooks, templates) into `resources/seed/`.
- The `dist/` artifact is now reproducible from a clean check-out.

#### Tier 3.2 — API keys encrypted at rest
- `src/main/secrets.ts` wraps Electron `safeStorage` (OS keychain backed). On macOS / Windows it's transparent; on headless Linux without a keychain it falls back to a `PLAIN:` prefixed buffer with a logged warning.
- New migration `002_encrypted_keys.sql` adds `apollo_api_key_enc BLOB` and `anthropic_api_key_enc BLOB` columns; clears the legacy plaintext columns at upgrade.
- `settings:setAnthropicKey` / `settings:setApolloKey` now encrypt before write. `settings:get*` and the LLM client decrypt transparently. Plaintext columns are kept readable for one upgrade cycle as a fallback.
- Health page surfaces an `OS keychain encryption` check. Anthropic / Apollo key checks display `[encrypted]` or `[plaintext — re-save to encrypt]`.

#### Tier 3.3 — Persistent retry queue
- New migration `003_send_queue.sql` adds `send_queue` table (id, outreach_id, attempts, max_attempts, last_error, next_attempt_at, status, timestamps) with a partial index on `(status, next_attempt_at)`.
- `src/main/agent/sendQueue.ts`: enqueue, list, cancel, worker. Backoff schedule **1m, 5m, 15m, 60m, 240m**, max 5 attempts. Worker scans every 1 minute (first tick after 30s).
- `approveAndSend` now distinguishes `WatchdogTimeout` from other errors — timeouts auto-enqueue (transient), other errors mark `failed`.
- Worker survives app restart because the queue persists in SQLite. Sends marked exhausted set the outreach row to `failed` with the last error.
- IPC: `queue:list`, `queue:cancel`. Wired into main entry's startup/shutdown.

#### Tier 3.4 — Watchdog timeouts on Playwright
- `src/main/browser/watchdog.ts`: `withWatchdog(label, timeoutMs, fn, opts)` wraps any async call with a hard timeout. On timeout, throws a typed `WatchdogTimeout` error and optionally calls `onTimeout` cleanup.
- `WATCHDOG.PROFILE_CAPTURE_MS = 90s`, `CONNECT_SEND_MS = 60s`, `INMAIL_SEND_MS = 90s`, `LOGIN_CHECK_MS = 30s`, `REPLY_SYNC_MS = 90s`.
- Wraps `capturePublicProfile` (research module) and both send paths (`sendConnectionRequest`, `sendSalesNavInMail`). Stuck `page.goto` no longer halts the agent indefinitely.

#### Tier 3.5 — Husky + lint-staged
- Pre-commit hook (`.husky/pre-commit`) runs `lint-staged`, which auto-fixes ESLint issues and formats with Prettier on staged files.
- Configured per-glob: `src/**/*.{ts,tsx}` and `tests/**/*.ts` get lint+prettier; `src/**/*.css` gets prettier only.
- Bad commits caught before they enter the repo.

#### Tier 3.6 — Module boundary lint
- New `eslint-plugin-import` integration in `eslint.config.mjs`.
- **Renderer** files cannot import from `src/main`, can't import `electron`, can't import Node-only modules (`better-sqlite3`, `playwright`, `electron-log`). Forces all main-process access through `window.api` (the typed contextBridge).
- **Main** files cannot import renderer code, React, or react-dom.
- Catches the most common Electron foot-gun: a developer pulling `app.getPath()` into a renderer file and hitting "fs is not defined" at runtime.

#### Tier 3.7 — README diagrams
- New Mermaid architecture diagram showing renderer → preload → main → agent core → DB / Browser / LLM.
- New sequence diagram for the single-prospect flow (research → gates → drafting → QA → send) including auth-required and watchdog-timeout branches.
- New ER diagram for the SQLite schema (8 tables, relationships).
- Project-layout tree expanded to reflect all `health/`, `secrets.ts`, `sendQueue.ts`, etc.
- Reliability section enumerates every auto-healing primitive.

#### Tier 3.8 — Test coverage from 50 → 73 (+23)
- `tests/watchdog.test.ts` (5 tests): fast resolves, slow rejects with `WatchdogTimeout`, error preservation, `onTimeout` cleanup, label/ms surface.
- `tests/secrets.test.ts` (8 tests): encryption available — round-trip, null/empty short-circuits; encryption unavailable — `PLAIN:` prefix fallback round-trip.
- `tests/log-tail.test.ts` (5 tests): electron-log line regex parses info/warn/error formats, handles colons in body, returns null for non-matches.
- `tests/migrations.test.ts` (5 tests): file naming, version numbers sequential from 1, `migrate.ts` references every file in `migrations/`, key schema landmarks per migration.

### Changed
- `data/seed/`: nothing changed — assets remain identical to Day 6.
- `src/main/agent/sending.ts`: distinguishes `WatchdogTimeout` from permanent failures (the former auto-enqueue).
- `src/main/index.ts`: starts and stops `sendQueueWorker` alongside `backgroundSync`.
- `src/main/health/preflight.ts`: new `encryption-available` check; Anthropic / Apollo checks now surface encrypted/plaintext state.

### Stats
- 73 Vitest tests (+23) passing in ~700ms
- 22 smoke checks (3 skipped on bare Node)
- Renderer: 371 KB (unchanged); Main: ~95 KB (+7 KB from sendQueue + secrets); Preload: 3.4 KB
- 0 lint errors, 0 warnings; typecheck silent; build silent
- 9 nav tabs, 6 components
- 3 schema migrations registered (v1 initial, v2 encrypted_keys, v3 send_queue)
- New deps: `husky`, `lint-staged`, `eslint-plugin-import`
- electron-builder packaging verified end-to-end (`npm run package`)

## Day 6 — May 4, 2026 (Tier 2 reliability pass)

The system gets noticeably more resilient. Six new auto-healing primitives. App can recover from transient API failures, expired LinkedIn sessions, missing Playwright Chromium binary, schema drift on update, and accidental data loss.

### Added

#### Tier 2.1 — Anthropic 429 backoff + retry
- `callWithRetry` helper in `src/main/agent/llm.ts` with exponential backoff (1s, 2s, 4s, 8s) for transient failures (429 / 5xx / network). Max 4 retries.
- Status callback streams retry messages into the orchestrator's event log so the user sees `qa-score rate limited — retry in 4s (attempt 2/4)` mid-pipeline.
- Same backoff helper inlined in `inmail.ts`.

#### Tier 2.2 — `npm run smoke`
- New `scripts/smoke.mjs` validates 22 invariants: seed files exist, CSV row counts ≥ thresholds, schema parseable, locked formula text constants, regex parity for slug / tenure / auto-drop signals.
- Native-binding-aware: probes better-sqlite3 up front; gracefully skips schema-init checks when run from plain Node (binding is rebuilt for Electron's ABI).
- Final result: **22 pass / 0 fail / 3 skipped** locally. Wires into CI as `npm run smoke` after `npm test`.

#### Tier 2.3 — Versioned schema migrations
- New `src/main/db/migrate.ts` runner. Each migration is a numbered `.sql` file in `migrations/` (Vite inlines via `?raw`). Uses `PRAGMA user_version` to track applied migrations. Forward-only.
- Existing schema becomes `migrations/001_initial.sql`. Adding a future migration is just dropping `002_xxx.sql` and adding it to the `MIGRATIONS` array.
- `initSchema()` now logs `schema migrations: vN → vM (applied …)`.

#### Tier 2.4 — SQLite backup / restore
- `src/main/db/backup.ts`: online backup using better-sqlite3's `db.backup()` API (WAL-safe). Auto-prunes to last 20 snapshots. Backup files named `app-YYYY-MM-DD_HH-MM-SS.sqlite` under `userData/backups/`.
- IPCs: `backup:create`, `backup:list`, `backup:restore`, `backup:delete`.
- Settings → "Backups" panel: create, list, restore (with confirm prompt), delete.

#### Tier 2.5 — LinkedIn session-expiry auto-recover
- Orchestrator catches auth-related errors (`session expired`, `redirected to login`, `/authwall`, `401`).
- Emits new `auth_required` event kind. Renderer auto-launches the LinkedIn login flow (toast + `loginLinkedIn()` IPC).
- Orchestrator polls `runtime-state` for ≤ 3 minutes; once `logged-in` is observed, the in-flight pipeline run resumes from research.
- PipelineProgress visualizes the research phase as warn/yellow during the pause.
- Drops to `auth_required_timeout` if the user doesn't log in within 3 min.

#### Tier 2.6 — Playwright Chromium auto-install
- `src/main/health/playwrightInstall.ts`: detects missing binary via `playwright.chromium.executablePath()`; runs `npx playwright install chromium` with stdout/stderr streamed through IPC.
- IPC `playwright:status`, `playwright:install`, plus `playwright:install:progress` event channel.
- Health page shows an "Install Chromium" button next to the failing preflight check; live install log appears as a separate panel during install.

### Why each one matters

- **429 backoff**: Anthropic rate-limits when the demo hits a peak. Without backoff, the pipeline hard-fails on the very first 429. With it, retries are silent unless they take >1s, and the user sees a clear status if they do.
- **Smoke test**: gives CI a 1-second sanity check. If a future PR breaks seed loading or regex parity, smoke fails before the full Vitest suite runs.
- **Migrations**: when we ship schema v2, existing installs upgrade cleanly instead of bricking. Day 1 installs still work after Day 60 updates.
- **Backups**: insurance. If a migration goes wrong or a stray restore wipes data, there's a recoverable snapshot. Pruning to 20 keeps disk use bounded.
- **Session-expiry recover**: removes the most demo-fragile failure mode. Pipeline stops, user logs back in, pipeline resumes — without manual restart.
- **Chromium auto-install**: the single most likely first-launch failure on a fresh machine. Detected, fixed, installed without leaving the app.

### Stats
- 50 Vitest tests still passing in ~950ms (no test churn — pure additions)
- 22 smoke checks (3 skipped in pure Node due to native ABI; would all run in CI with Electron's Node)
- Renderer: 371 KB JS + 30 KB CSS (+6 KB)
- Main: ~88 KB; Preload: 3.3 KB
- Lint: 0 errors, 0 warnings; typecheck: silent; build: silent
- 9 nav tabs, 6 components
- New deps: none (zod added Day 5)
- Migration: schema v1 (initial). Future versions append.

## Day 5 — May 4, 2026 (auto-healing + QA pass)

Reliability and self-healing pass. Validates that the app degrades gracefully when LinkedIn DOM shifts, when the LLM returns garbage, when the DB hiccups, when something throws unexpectedly in a render path.

### Added
- **Preflight self-test** (`src/main/health/preflight.ts`). Runs 11 cheap checks at startup and on demand: schema version, DB writable, DB integrity_check, TAM/DNC/prior-contact seed counts, Playwright Chromium binary presence, Playwright profile dir, LinkedIn session state, Anthropic key, Apollo key, sends-today vs INC-028 cap, 24h drop rate. Each result is structured (`status`, `detail`, optional `fixHint`).
- **Log tail IPC** (`src/main/health/logTail.ts`). Reads the last ~256 KB of `electron-log`'s main.log file, parses out timestamp + level + text, returns up to 200 entries. Renderer reads this to surface activity inline.
- **System Health page** (new "Health" sidebar tab, `Cmd+8`). Renders preflight diagnostics with status pills + fix hints, and a scrollable, color-coded recent-log viewer. Auto-refreshes every 15s.
- **Zod-validated LLM responses with auto-retry** (`llm.ts`). Hook generator and D2/D3 scorer now parse Anthropic responses through `HookSchema` / `D2D3Schema`. On parse failure, a single retry runs with a stricter system message ("respond with ONLY a single JSON object…"). On second failure, falls back to the heuristic, with the reason logged. Catches malformed Claude outputs that previously slipped through.
- **React error boundaries per page** (`components/ErrorBoundary.tsx`). Every top-level page in `App.tsx` is wrapped with an error boundary keyed by page name. An unexpected render error shows a recovery card with the stack trace + Try Again / Reload buttons; the rest of the shell stays usable.
- **Selector chain fallbacks for the brittle LinkedIn extractions** (`browser/linkedin.ts`):
  - Connection degree: 4-pass chain (explicit "Xth degree" → "·" badge → dedicated badge selector → primary-action heuristic).
  - Connection / follower counts: regex on raw text + dedicated node fallbacks.
  - About section: section selector + aria-labelledby fallback.
  - Current title: experience top card → first-of-type entry → headline parse.
  - Current company: experience top card → company-link href → headline parse.

### Why each one matters

- **Preflight + Health page**: catches ~80% of "why doesn't it work" issues before the user hits the broken flow. Schema migration drift, missing Playwright Chromium, expired LinkedIn session, malformed seeds — all surface in a single visible place.
- **Zod retry**: Sonnet/Opus occasionally return JSON with extra prose or missing fields. The previous code threw and fell straight to heuristic; now it retries once and recovers most of those.
- **Error boundaries**: an Analytics chart bug used to blank the entire app. Now it shows "Something broke in Analytics" while Activity / Home / Audit keep working.
- **Selector fallbacks**: LinkedIn ships DOM changes every few weeks. The chain means a single selector regression doesn't kill capture — it falls back through 3-4 alternatives with logged warnings.

### Stats
- 50 Vitest tests still passing in ~770ms (no test churn — pure additions)
- Renderer: 365 KB JS + 30 KB CSS (+10 KB from Health page + ErrorBoundary)
- Main: ~78 KB; Preload: 2.6 KB
- Lint: 0 errors, 0 warnings; typecheck: silent; build: silent
- 9 nav tabs (added Health), 6 components (added ErrorBoundary)
- New deps: `zod` (run-time validation)

## Day 4 — May 4, 2026 (later in the evening, end-to-end build-out pass)

A workflow-driven UX pass + de-risking polish. Approached as a sequenced plan with a validation gate after every phase (typecheck + lint + tests + build all green at every checkpoint).

### Phase 0 — Demo de-risking
- **Pipeline progress visualization** (`PipelineProgress.tsx`): replaces the raw event log on the wizard's "running" step with a vertical stepper. Each phase shows idle / active (animated) / pass / drop / warn / error with reason text. Raw event log stays available behind a `<details>`.
- **Empty states with action CTAs**: Activity now renders a centered card with "New Outreach" and "Load demo seeds" buttons when there's no data, instead of a blank table.
- **Bulk-import flow**: New "Bulk paste" mode in the wizard. Paste N LinkedIn URLs (one per line); the pipeline runs sequentially with per-row progress (pending → running → pass / drop / error), confidence scores, and drop reasons. Results stay reviewable in Activity.
- **CSV export**: Activity → "Export CSV" button. New IPC `export:activity` returns full outreach + prospect joined rows. Filename includes the date.
- **+15 tests** (now 50 total): auto-drop signal regex parity (Retired / Open to Work / Ex- / banking-risk / BPO-CX / claims-ops / software-dev-not-QA), tenure derivation regex behavior including realistic-bounds rejection.

### Phase 1 — Workflow-driven UX
- **Today's Actions on Home**: replaces flat counters with a stack of color-coded action cards: replies waiting, new accepts, drafts to review, sends-today progress bar (INC-028), recent drops. Each card shows the top 5 items with click-through to detail. Auto-refreshes every 10s. New IPC `analytics:todaysActions`.
- **Account drill-down**: New "Accounts" tab. Two-pane view — left sidebar lists accounts ranked by accept count with tier filter pills (all / Factor / G2 / TAM); main pane shows the picked account's stats (prospects, sent, accept rate), full outreach history table (clickable rows open detail), and prospects-researched list. New IPCs `accounts:list` and `accounts:detail`.

### Phase 2 — Polish
- **Command palette (Cmd+K)**: Modal with fuzzy search across nav actions + all prospects + all accounts. Arrow keys navigate, Enter selects, Esc closes. Loads on first open. Sidebar shows the keyboard shortcut.
- **Sidebar refresh**: 8-tab nav (added Accounts), kbd-shortcut hint per row, command-palette and shortcuts buttons in the footer.

### Skipped (intentionally, to keep the core stable)
- Drawer pattern for OutreachDetail — current full-page detail view works; drawer is a UX-only refactor that could regress. Deferred.
- Notification center — accepts/replies surface as toasts + show in Today's Actions; persistent inbox can come post-demo.
- Light theme toggle — bigger refactor than fits before demo; CSS uses hardcoded colors.

### Stats
- 50 Vitest tests passing in ~770ms
- Renderer: 354 KB JS + 29 KB CSS (+44 KB from new pages + command palette + Today's Actions)
- Main: ~70 KB; Preload: 2.4 KB

## Day 3.5 — May 4, 2026 (late evening, post-BDR-update sync)

Pulled the v2 LinkedIn connection-batch skill (locked Apr 30, committed May 3-4) from the BDR repo and ported the gaps into the app.

### Added
- `data/seed/skills/linkedin-connection-batch.md` (549 lines, v2, the canonical source of truth) and `data/seed/skills/linkedin-connect.md` (v1.2 "preload-URL" reference) ported from BDR.
- `data/seed/playbooks/linkedin-batch-quality-gate.md` and `linkedin-send-preflight.md` ported from BDR.
- New `Skills + Playbooks viewer` (replaces the static Playbook page) — left sidebar lists locked formulas + ported BDR skills + ported BDR playbooks; right pane renders the markdown verbatim. New IPC `skills:list` reads `data/seed/{skills,playbooks}/` on every refresh.
- LLM hook prompt rewritten with the v2 hook quality framework: GREEN / YELLOW / RED tenure buckets with verbatim example hooks per bucket, activity-anchored hook guidance (Tier A/A+/A++), special hook types (stack/skill, career arc, dual-role, cross-company), forbidden phrase list extended.
- Hook generator now accepts `tenureInCurrentRoleMonths` and returns a `tenure_bucket` selection in the JSON response.
- Heuristic tenure derivation in `research.ts` (regex on headline/about for "X years at" / "X months as" patterns).
- **Auto-drop signal detection** at the end of research (Apr 30 lock): Retired, Open to Work, Ex-, BPO/CX/Data Entry, Software-dev-not-QA, Banking risk/AML, Insurance Claims Ops, Sparse profile. Hard-stop gate in the orchestrator that drops before drafting.
- INC-027 strict aria-label send: `sendConnectionRequest` now requires the strict aria-label `Invite ${expectedFullName} to connect` when name is supplied. Post-click dialog name verify also implemented (catches recommendation-card mis-clicks).
- INC-028 daily-send-throttle: soft cap at 10/day, hard cap at 20/day for connection requests. Header banner shows a "Sends today" pill with cap visibility. Soft-cap path returns a structured `throttle` field; UI displays a confirm dialog offering to override.
- New IPC `analytics:todaysSendCount(motion?)` and `outreach:simulateSend` (already existed).
- `SKILL_GAPS.md` — explicit log of what's ported from v2 vs what's still pending. Documents the Sales Nav Rung 3/4 capture, reply-check ladder, career arc check, preload-URL send pattern, and other v2 features that haven't been fully wired yet.

### Changed
- `OutreachDetail.tsx` and `Activity.tsx` continue to work unchanged with the new auto-drop drop reasons.
- Research now persists the auto-drop pattern names into `evidence.notes` for audit visibility.
- Header banner refresh interval reads daily send count alongside API key statuses.

## Day 3 — May 4, 2026 (later same evening)

Polish + de-risking pass before Rob's desktop test.

### Added
- Per-prospect detail view (`OutreachDetail.tsx`) — open from any Activity row click. Shows full draft, evidence, gate-decision history, and inline edit / re-score / send actions.
- Activity page: search input + status filter pills (`all` / `draft` / `sent` / `accepted` / `replied` / `failed` / `dropped`) with live counts.
- Keyboard shortcuts: `Cmd+1`–`Cmd+7` for tab switching, `Cmd+N` for New Outreach, `Cmd+/` for shortcuts overlay, `Esc` to close detail / overlays.
- Shortcuts overlay component (`Shortcuts.tsx`).
- LinkedIn capture selector hardening: page-title and `og:title`/`og:description` fallbacks for name + headline; explicit login-redirect detection that throws a clear error.
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) — runs typecheck + tests + build on every push and PR.
- ESLint flat config + Prettier config + npm scripts (`lint`, `format`).
- `HANDOFF.md` — onboarding for the next agent session (file layout, gotchas, Rob's preferences).
- `CHANGELOG.md` — this file.

### Changed
- `Activity.tsx` rows are clickable; opens detail.
- `App.tsx` shell renders detail view as an overlay layer over the current tab.
- Sidebar nav buttons now display the keyboard shortcut on the right.

### Fixed
- Lint cleanups: removed unused `Page` import (`linkedin.ts`), unused `ConfidenceScore` import (`NewOutreach.tsx`), and dropped a stale eslint-disable comment.

## Day 2.5 — May 4, 2026 (afternoon)

Polish + tests pass before downloading to desktop.

### Added
- Header health banner (LinkedIn / Anthropic / Apollo pills, auto-refresh every 8s).
- Toast notification system (success / error / info; 5s default TTL).
- First-run onboarding overlay (welcome → LinkedIn login → Anthropic key → done).
- Playbook page — in-app viewer of locked formulas, gate definitions, INC-022 / INC-026 protocols.
- Audit page — pipeline audit log with phase / decision / reason / timestamp filtering.
- Edit draft inline (body + subject) with live D1 re-score; "Re-score (LLM)" button for D2/D3.
- Simulate send mode — marks outreach sent without touching LinkedIn (rehearsal insurance).
- Demo seed loader (Settings → "Load demo prospects") inserting 3 pre-baked prospects (Rami @ SailPoint, Gabija @ Rocket, Barak @ Pathlock) with full evidence and 9.0–9.5/10 drafts.
- Evidence card on the review step (live LinkedIn capture details with verbatim quote).
- `runtime-state.ts` for in-memory LinkedIn login status.
- Vitest setup (`vitest.config.ts`, `tests/setup.ts`) + 35 deterministic tests across `gates`, `drafting`, `qa`, `inmail`.

### Changed
- Bumped renderer bundle from 254 KB → 310 KB (added pages + components).
- `outreach:detail` IPC now returns full evidence + parsed confidence object.
- `outreach:update` re-computes D1 deterministically on save.

## Day 2 — May 4, 2026 (afternoon)

Anthropic SDK + InMail motion + reply sync + analytics.

### Added
- `llm.ts` — Anthropic SDK wrapper with model split (Sonnet 4.6 for hooks, Opus 4.7 for D2/D3 scoring) and graceful heuristic fallback when no API key.
- LLM-driven hook generation in `drafting.ts` with evidence quote traceability.
- LLM-driven D2 + D3 scoring in `qa.ts`.
- Sales Nav InMail motion (`inmail.ts`): 5-paragraph hero formula, subject + body, A/A+/A++ tier system.
- Sales Nav InMail send (`linkedin.ts`): keyword search → lead page → Message composer → readback subject + body → send.
- Phase 7.5 enhancement loop in orchestrator (one remediation pass on sub-9 confidence).
- Reply-sync worker (`sync.ts`) — invitation manager scan + inbox scan, on-demand + 15-min background.
- Analytics dashboard (`Analytics.tsx`) — totals, by-motion, drop reasons, last-14-days trend bars.
- Settings: Anthropic + Apollo key fields with masked display.

### Changed
- Orchestrator dispatches based on motion (`runSingle` for connect, `runInMail` for InMail).
- Background sync starts on app launch, stops on quit.

## Day 1 — May 4, 2026 (afternoon)

Project bones + working connect-request happy path.

### Added
- Electron 33 + electron-vite + TypeScript + React 18 + Tailwind project scaffold.
- SQLite schema (10 tables): `users`, `accounts`, `prospects`, `evidence`, `outreach`, `dnc`, `prior_contacts`, `analytics_daily`, `gate_log`, `schema_meta`.
- Schema seeded from BDR assets at first launch:
  - 312 TAM accounts (`tam-accounts-mar26.csv`)
  - 6 G2-authorized accounts
  - 74 DNC entries (extracted from BDR/CLAUDE.md by `scripts/extract-dnc.mjs`)
  - 856 prior-contact rows (`MASTER_SENT_LIST.csv`)
- Playwright persistent-profile session manager (`session.ts`) + LinkedIn login launcher.
- LinkedIn public-profile capture (`linkedin.ts`) — name, headline, location, degree, follower/connection counts, current title/company, recent activity.
- Connection-request locked formula (INC-022 v1) with deterministic D1 enforcement (229–278 chars, no em dashes, no `?`, "Rob" inline, required phrases).
- INC-022 readback send protocol — extract → inject → readback → char-for-char compare → send only on match.
- Agent gates: 0.5 DNC, 0.6 prior contact, 0.7 degree, 0.7.5 deliverability (INC-030), 1.5 TAM scope, 3 Apollo dedup (stub).
- Phase 7.5 confidence gate with D1 deterministic + D2/D3 heuristic placeholders (LLM swap on Day 2).
- Single-prospect orchestrator emitting phase events to renderer.
- React UI: sidebar shell + Home / New Outreach (6-step wizard) / Activity feed / Settings.
