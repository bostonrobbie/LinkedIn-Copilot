# Skill gap log — what's ported from BDR vs what's still pending

_Last refresh: Day 15 (May 5, 2026) — synced to BDR `origin/main` commit `26806de`_

The BDR repo's `linkedin-connection-batch/SKILL.md` (now **v7**, locked May 1, 2026) and `inmail-batch-v2/SKILL.md` (now v3.2) are the canonical sources of truth. This doc lists what the app implements vs what's still pending.

## v7 deltas (May 1, 2026 — post-Batch-G+H rate-limit halt)

The May 1 refresh added a "Send-Time Extreme Care Protocol" with new Phases 9.0–9.6, plus Apr 30 evening additions (Gate 0.5, Gate 0.7, mandatory Sales Nav right-panel + activity + about captures, Tier B BANNED). Status of each:

| v7 phase / rule | App status |
| --- | --- |
| **Phase 9.0 — Pre-session rate-limit detection** (control-profile probe) | ✅ partially — `controlProfileCheck` runs after ≥24h pause using a single control profile (Bill Gates). v7 specifies sampling 4 candidates from the send-ready file. Single-probe is good enough for the MVP single/bulk flow. **Gap:** 4-profile sampling for batch-mode would be more robust. |
| **Phase 9.0.5 — Rate-limit halt decision tree** | ❌ pending — when 4-of-4 sample fails, halt entirely with cooldown timer + alternative-motion suggestion (InMail / wait). Today we just abort the send. |
| **Phase 9.1 — Per-send preflight checklist** | ✅ — covered by send pipeline (INC-022 readback, INC-027 strict aria-label, INC-023 pending check). |
| **Phase 9.2 — INC-022 char-for-char readback** | ✅ — `sendConnectionRequest` does readback + char-for-char compare before clicking Send. |
| **Phase 9.3 — INC-027 post-click dialog verification** | ✅ — verifies invitation dialog references expected name. |
| **Phase 9.4 — INC-024 MASTER append (immediate)** | ❌ pending — we log to our own `outreach` table; v7 requires append to BDR's `MASTER_SENT_LIST.csv` per send. Decision: keep app self-contained for MVP; periodic batch export is the deferred path. |
| **Phase 9.5 — In-session cap watch** | ✅ — INC-028 daily (10 soft / 20 hard) + 7-day rolling (80 soft / 100 hard) caps both enforced at send time. |
| **Phase 9.6 — End-of-session reconciliation** | ❌ pending — sends count vs MASTER append count + remaining-cap report. We have analytics + Today's Actions but no formal end-of-session reconciliation pass. |
| **Gate 0.5 — Apollo `emailer_campaign_ids` check** | ✅ — Phase 3 dedup gate; real Apollo `/v1/people/match` API call returns `emailerCampaignIds` populated. |
| **Gate 0.7 — Gmail Sent + received prior-email search** | ❌ pending — Phase 0.6 ladder uses prior_contacts (MASTER seed), DNC, app outreach, warm engagement. Gmail is not integrated. |
| **MANDATORY Sales Nav right-panel capture** | ❌ pending — we have Rung 4 (`/details/experience/`) capture but not the lead-page right-panel (Strategic Priorities + Shared Posts). |
| **MANDATORY recent activity capture** | ✅ — `recent_activity_text` in evidence. |
| **MANDATORY About-section verbatim quote** | ✅ — `about` in evidence. |
| **Tier classification (A++/A+/A) — Tier B BANNED** | ✅ — `drafting.classifyTier` returns A / A+ / A++ only. No Tier B. |
| **5-char chunk URN extraction (content filter workaround)** | n/a — Playwright context, no content filter. |
| **/details/experience/ subpage RESTRICTED for non-1st-degree** | ⚠ partial — our Rung 4 capture catches errors silently. **Gap:** make the failure explicit when the subpage is restricted (we don't differentiate from "selector not found"). |
| **Public headline can drift opposite to Experience entry — never patch from headline** | ✅ — drafting prefers Experience-entry data; LLM hook prompt explicitly instructs against headline-only inference. |
| **Refresh Rung 3 within 24h of every send (Gate 7 freshness)** | ⚠ informational — we capture timestamp on every research run; no enforcement that the capture is <24h before send. **Gap:** a freshness gate before send. |
| **Per-candidate evidence storage helper** | ✅ — `evidence` table per prospect with all captured fields. |

## Pending (not yet ported)

The full v2 skill document is shipped at `data/seed/skills/linkedin-connection-batch.md` and rendered in the **Playbook** tab. Skim it when something looks off — most of the time, the answer is in the v2 skill, not in this app's code.

## Implemented in this app

| v2 skill content | Implementation |
| --- | --- |
| INC-022 readback at send | `src/main/browser/linkedin.ts` — char-for-char compare before clicking Send (both connection request and InMail) |
| INC-023 Pending pre-send check | Same file — inspects primary action button text for "pending" before opening invite modal |
| INC-026 Gate 7 live title capture | Captured into `evidence` table on every research run; rendered in OutreachDetail |
| INC-027 strict aria-label match | `sendConnectionRequest` requires `aria-label="Invite ${expectedFullName} to connect"` exactly when name is supplied. Falls back to substring match only when name is absent. Post-click dialog name verify also implemented. |
| INC-028 daily-send-throttle | Soft cap at 10/day, hard cap at 20/day for connection requests. Visible in header banner. Override prompt on soft-cap. |
| Locked formula (INC-022 v1) | `src/main/agent/drafting.ts` — verbatim template with deterministic D1 enforcement |
| Hook quality framework — tenure buckets (GREEN / YELLOW / RED) | LLM hook prompt updated. Tenure-in-current-role derived heuristically from headline/about and passed as input. |
| Auto-drop signals at Gate 7 | `src/main/agent/research.ts` `detectAutoDropSignals` — Retired, Open to Work, Ex-, BPO/CX/Data Entry, Software-dev-not-QA, Banking risk/AML, Insurance Claims Ops, Sparse profile. Run as a hard-stop gate in the orchestrator. |
| Dept-match decision tree | `pickDept()` in `drafting.ts` — heuristic regex on title/headline. Matches v2 tree exactly. |
| Gate -1 TAM scope | Phase 1.5 in orchestrator. Drops anything not in TAM/Factor/G2 accounts. |
| Gate 0 Dedup (basic) | Phase 0.6 prior-contact gate. Hits MASTER_SENT_LIST seed. |
| Gate 0.7 LinkedIn-degree gate | Phase 0.7. Drops 1st-degree to DM batch. |
| Gate 0.7.5 Deliverability (INC-030) | Phase 0.7.5. Drops conn<20 AND followers<20; warns conn<50 OR followers<50. |
| Gate 7 LinkedIn capture | Public-profile capture with multi-selector + meta-tag fallback (Day 3). |
| Phase 8 APPROVE SEND gate | Review screen with 9.0/10 confidence floor; `Approve & Send` button only enabled when D1 = 10/10 AND overall ≥ 9.0. |
| Phase 9 throttled send loop | Single-prospect manual send; INC-028 soft cap at 10/day surfaces a confirm prompt. |

## Pending (not yet ported)

These are the remaining gaps after Days 1–11. The app now handles connection requests + InMail end-to-end with research depth, gate ladder, retry queue, and reply lifecycle. The remaining items are either lower-priority or require sustained work.

| v2 feature | Status | Notes |
| --- | --- | --- |
| **Rung 4 — `/details/experience/` subpage capture** | ✅ shipped Day 9 | Captured automatically as part of `capturePublicProfile`; persisted to `evidence.experience_subpage`. |
| **Career arc check (claims-ops, banking-compliance, hardware-defense, clinical-pharma)** | ✅ shipped Day 10 | `agent/careerArc.ts` — runs as Phase 4.5; 4 patterns + career-grown-internal positive signal. |
| **Apollo `/v1/people/match` API integration** | ✅ shipped Day 10 | Real API call with backoff; populates `apollo_company`/`apollo_title`/`apollo_employment` on the prospect. |
| **Apollo `/v1/mixed_people/search` for sourcing** | ✅ shipped Day 10 | Used by auto-prospect-enroll batch flow. |
| **Auto-prospect-enroll batch flow** | ✅ shipped Day 10 | Wizard "Batch from TAM account" mode with account picker, Apollo sourcing, pre-screen filter, bulk pipeline run. |
| **Patch-and-re-QA on edits** | ✅ shipped Day 9 | `outreach:update` re-runs D2/D3 against Anthropic when LLM available. |
| **Reply-check ladder (4 sources)** | ✅ shipped Day 9 | `priorContactCheck` checks prior_contacts, dnc, app outreach, warm engagement. |
| **Reply classifier + auto-DNC + manual override** | ✅ shipped Day 9 + Day 11 polish | LLM P0-P4 classifier; auto-DNC on hostile; OutreachDetail re-classify button + manual override + DNC reversal. |
| **INC-030 stop-loss** | ✅ shipped Day 9 | Send queue caps InMail credit-burn retries at 1; auto-DNC on exhaustion. |
| **Pre-resume control-profile check** | ✅ shipped Day 10 | `controlProfileCheck` runs before next send if ≥24h since last successful send. |
| **7-day rolling throttle (INC-028)** | ✅ shipped Day 10 | 80 soft / 100 hard cap on rolling 7-day window. |
| **Wrong-company gate (1.5b)** | ✅ shipped Day 9 | Apollo vs LinkedIn cross-check; tolerant to suffix differences; drops on hard mismatch. |
| **Slug preflight on 404** | ✅ shipped Day 10 | Capture detects "Profile not available" / 404 pages and throws actionable error. |
| **Send queue UI + retry/cancel/re-queue** | ✅ shipped Day 11 | New "Send Queue" sidebar tab with per-row actions. |
| **API key health validation** | ✅ shipped Day 11 | Inline `Check key health` button in Settings calls Anthropic + Apollo health endpoints. |
| **URL normalization + dedup in bulk paste** | ✅ shipped Day 11 | `shared/url.ts` — strips tracking params, lowercases, de-dups by slug, separates Sales Nav / pub URLs with clear error reasons. |
| **Auto-reload after backup restore** | ✅ shipped Day 11 | Settings → Data → Restore now auto-reloads the renderer 800ms after restore success. |
| **Preload-URL + shadow DOM dispatchEvent send pattern** | ❌ pending | Current Playwright `page.locator(...).click()` flow works. The v1 BDR LinkedIn-connect skill recommends shadow-DOM dispatch. Riskier change — keep current as known-working fallback. |
| **Gate 8 Sales Nav Strategic Priorities right-panel** | ❌ pending | Optional even in v2. Useful for InMail batches. Would capture account-level intent signals from Sales Nav lead-page right panel. |
| **MASTER_SENT_LIST.csv bidirectional sync to BDR repo** | ❌ pending | App keeps its own outreach ledger. Periodic export to BDR's MASTER would close the cross-system dedup gap. Decision deferred — keeping app self-contained for now. |
| **Apollo employment_history → prior-tenure detection** | ❌ pending | We capture `apollo_employment` but only use `apollo_company`. Parsing the JSON for "X years at company Y" patterns would catch the Aleksandar career-grown arc more precisely than the Rung 4 regex. ~1h. |
| **Re-engagement compose flow** | ❌ pending | Today's Actions surfaces stale P1 contacts. A "Compose re-engagement message" button on those rows that drafts a soft re-touch would close the lifecycle loop. ~2h. |
| **DM batch motion for 1st-degree spillover** | ❌ pending | When Phase 0.7 catches a 1st-degree, we drop. v2 skill says route to a separate DM batch. New motion needed. |
| **Manual classification override on the Send Queue / Activity table** | ❌ pending | Currently override is on OutreachDetail only. Bulk operations would speed triage. ~30 min. |
| **`apollo_employment` enriched view in OutreachDetail** | ❌ pending | The data is in the prospect row but not surfaced. ~30 min for a UI panel. |

## How to keep this in sync

When the BDR repo's `linkedin-connection-batch/SKILL.md` updates:

1. From the linkedin-copilot project root, copy the latest:
   ```bash
   cp ../BDR/skills/linkedin-connection-batch/SKILL.md data/seed/skills/linkedin-connection-batch.md
   cp ../BDR/skills/linkedin-connect/SKILL.md data/seed/skills/linkedin-connect.md
   cp ../BDR/memory/playbooks/linkedin-batch-quality-gate.md data/seed/playbooks/
   cp ../BDR/memory/playbooks/linkedin-send-preflight.md data/seed/playbooks/
   ```
2. Re-extract DNC if CLAUDE.md changed: `node scripts/extract-dnc.mjs`.
3. Diff this file against the skill changelog. Update implementation gaps as needed.
4. Update `CHANGELOG.md`.

The Playbook tab in the app reads from `data/seed/skills/` and `data/seed/playbooks/` on every refresh, so the in-app reference is always current with whatever's on disk.
