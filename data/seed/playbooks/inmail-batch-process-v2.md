# InMail Batch Process v3.4 — Locked May 4, 2026
## Updated SOP after batches #8-#11 + batch #12 + batch #13 (full arc) + batch #14 + batch #15 (full arc) + batch #16 sourcing-time TAM lock + batch #16 full-profile-read mandate

**v3.4 patch (May 4, batch #16 second look — full-profile read is mandatory):**
- Per Rob's directive: "I don't just want LinkedIn header research, I want it to read the whole profile."
- Phase 4 evidence file required-non-empty list expanded: `about_section`, `current_role_description` (from Experience entry verbatim, not headline), `prior_role_summary`, `skills_top5`, `education_summary`, `featured_summary`, `recent_activity_full`, `live_headline`, `connection_degree`, `sales_nav_banner_title`.
- **Programmatic capture procedure (NEW):** navigate → `window.scrollTo(0, document.body.scrollHeight)` → wait 4-6s → `document.body.innerText` with >20k char limit → verify section headers ("About", "Experience", "Skills", "Education", "Activity") all present. If any missing, retry once with longer wait, then escalate to Sales Nav lead-page.
- **Public-profile restriction handling:** 3rd-degree LinkedIn restrictions may hide About/Experience/Skills even after scroll. Sales Nav lead-page is the MANDATORY fallback. Apollo data is NEVER a fallback (v2.8 rule still in force).
- **Phase 4.5 depth audit (strengthened):** schema-satisfied-by-30-second-capture is the regression v3.0 caught conceptually but didn't enforce programmatically. v3.4 makes scroll-to-bottom + verbatim prose extraction the mandatory gate. Empty `about_section` field with profile-section-visible = FAILED capture = drop candidate.
- Why locked: batch #16 v2 evidence files had `about_section: Not in capture` for all 4 picks. The orchestrator was satisfying the schema by writing "not captured" notes rather than actually reading the profile. v3.4 closes that loophole.

**v3.3 patch (May 4, batch #16 sourcing — TAM-bounded pool made unambiguous):**
- Phase 0.4 NEW — TAM CSV load is MANDATORY before any account survey work begins. Main-context read of `tam-accounts-mar26.csv` (312 accounts) + survey of `sequences/g2-intent/` (6 G2-authorized accounts).
- Phase 1 BOUNDED POOL rule made directive (was descriptive). Candidate accounts MUST come from TAM CSV ∪ G2 authorized. No exceptions. No "vertical-fit" inference. No accounts surfaced by Apollo industry search alone or web research.
- Phase 1.5 strengthened: any account whose domain is not present in TAM CSV or G2-intent is dropped — no exceptions, no override path. Phase 1.5 is defense-in-depth for Phase 0.4 + Phase 1 rules; not the primary boundary.
- Why locked: skill v3.2 had Phase 1 wording "Inputs: TAM list (312 accounts), G2 authorized list (6 accounts)" — descriptive prose. Rob's directive at batch #16: "make sure the skill knows to pull from TAM accounts." The orchestrator could in principle surface a non-TAM account by vertical-fit reasoning without the skill explicitly blocking it. v3.3 closes the loophole.

**v3.2 patch (May 1, batch #15 send loop wrap):** Open Profile detection + Sales Nav search auto-correct fallback + tenure-only D2 floor clarification.
- **Open Profile FREE save detection:** Composer surfaces "Free to Open Profile" badge above the message body when recipient is an Open Profile member. The send completes WITHOUT a credit deduction. Skill must read this badge BEFORE assuming a paid send. Sebastian Thierer @ Geopagos (batch #15) was Open Profile — credit count showed no decrement which previously looked like a failure signal but is actually success+free.
- **Sales Nav search auto-correct fallback (Friction 9):** Sales Nav search bar auto-corrects rare company names (e.g. "Stori" → "story") and returns 0 results. Fallback procedure: if Sales Nav search returns 0 results for a known-good company, navigate directly to the candidate's public LinkedIn profile via slug. Pablo Sortino @ Stori (batch #15) — Sales Nav corrected "Stori" to "story", forcing public-profile fallback that succeeded.
- **D2 tenure-only floor clarification:** Phase 7.5 D2 rubric allows tenure-only hooks at 8/10 max ONLY when ABOUT-EMPTY + LINKEDIN-QUIET + NO current_role_description are all genuinely verified in evidence file. If any of those three is non-empty, drafter MUST upgrade hook to substantive material. Alon Dissentshik @ Bluevine (batch #15) is the canonical "all three genuinely empty" example — tenure floor acceptable.
- **Phase 2 pre-filter heuristic NEW:** when ranking Apollo search results, weight verbose/specific titles + long employment_history higher (proxy for likely-rich Sales Nav About section). See `memory/strategic-finding-may01-deep-research.md` for the full pattern.

**v3.1 patch (May 1, batch #15 send loop):** Phase 9.0 NEW — pre-send thread re-verify gate. Phase 0.6 prior-contact check at sourcing time is insufficient when hours/days pass before send. Re-run LinkedIn inbox thread search for ALL roster names IMMEDIATELY before the send loop starts. Any non-empty result blocks that candidate. Catches: replies that came in after sourcing, accidental InMails from another concurrent session, forwarded threads.

**v3.0 patch (May 1, batch #15 post-pause):** Sales Nav lead-page deep capture is MANDATORY FIRST, not a fallback.
- Phase 4 reordered: Sales Nav lead page is required first capture; public profile is supplemental.
- Evidence file gains 4 new required non-empty fields: `about_section`, `current_role_description`, `skills_top5`, `recent_activity_full`.
- Phase 4.5 depth audit is programmatic — schema-only fills (live_headline + degree + activity_status alone) no longer pass.
- Phase 7.5 D2 rubric: tenure-only hooks max at 8/10 — forces deeper research or drop.
- Trigger: Rob's challenge "did we do individual LinkedIn research?" exposed that v2.8/v2.9 evidence-file required fields were structurally shallow. Schema satisfied ≠ research done. v3.0 forces depth via additional required fields.

**v2.9 patch (May 1, batch #14 send loop, post-mortem):** Phase 9 concrete procedure with locked Sales Nav selectors and coordinates. Phase 9.5 NEW — Chrome MCP friction recovery via fresh tab group when compose page hangs (INC-029 pattern). Phase 4 evidence file gains `sales_nav_banner_title` and `sales_nav_tenure` fields (banner title is closer to formal title than self-styled public headline; banner tenure shows verbatim start date that public profile sometimes hides).

**v2.8 patch (May 1, batch #14 v3 regression catch):** Phase 4 HARD GATE — evidence file persistence + activity-claim verbatim traceability.
- Every InMail candidate MUST have `batches/active/<batch>/evidence-linkedin/<slug>.md` with non-empty live_headline, connection_degree, activity_status, evidence_quote_for_hook BEFORE drafts can be composed.
- If Chrome MCP page-text extraction times out or returns "BLOCKED": retry once, try Sales Nav lead page, then DROP candidate to backfill. Apollo data is NEVER a fallback.
- Phase 7.5 D2 rubric tightened: any "saw your X" / "congrats on Y" / "noticed your repost" claim in any draft MUST trace to a verbatim string in evidence file's `activity_quotes` section. No quote = AUTO-FAIL D2 = DROP.
- Phase 8 tracker MUST surface `Evidence` (file path) + `Quote` (verbatim string) columns per candidate so Rob can verify the LinkedIn trace at review.
- Trigger: batch #14 v3 drafts shipped with Apollo-only anchors when Chrome MCP hit friction (timeouts + content-filter "BLOCKED" responses on Rami + Barak's profile pages). Rob caught the regression: v2.7's "Apollo OR LinkedIn" D2 rule was too lenient. v2.8 closes the loophole.

**v2.7 patch (May 1, batch #14):** Phase 2.5 NEW — combined LinkedIn pre-screen runs BEFORE Apollo dedup. Cheap screens (free Chrome MCP captures + free MASTER grep) catch 1st-degree, deliverability-risk, and prior-sent candidates BEFORE we spend Apollo `apollo_people_match` credits on them. Saves ~70% of Apollo credits in network-dense verticals.

**Why locked:** Batch #14 burned 7 Apollo credits on dedup. 5 of those went to candidates that downstream gates rejected (4 1st-degree, 1 prior-sent). v2.7 reorders cheap-to-expensive.

This playbook captures the process improvements locked across the four-batch arc on Apr 30, 2026, the four v2.1 patches from batch #12, two further patches from batch #13 (v2.2 prior-contact gate, v2.3 TAM-scope verify), and the v2.4 confidence gate from the batch #13 draft audit. All InMail batches going forward must follow this sequence.

**v2.1 patches (May 1, batch #12):**
1. Phase 0.5 DNC cross-check — grep CLAUDE.md DNC table before sourcing
2. Phase 0.7 LinkedIn-degree gate — drop 1st-degree contacts to a separate DM batch (don't waste InMail credits on existing connections)
3. Phase 2/3 main-context-only lock — no subagent delegation for Apollo work
4. Phase 1 broaden-survey rule — 8–10 accounts when network density is high or Healthcare/Wellness/Fintech are in the mix

**v2.2 patch (May 1, batch #13 part 1):**
5. Phase 0.6 prior-contact check — MASTER_SENT_LIST grep + LinkedIn DM thread search per Apollo-clean candidate. Catches contacts Rob has touched via any channel or has an active LinkedIn DM thread with.

**v2.3 patch (May 1, batch #13 part 2):**
6. Phase 1.5 TAM-scope verification — main-context grep of `tam-accounts-mar26.csv` + `sequences/g2-intent/` for every account the Phase 1 survey surfaced. Locks the same fabrication-risk pattern as v2.1 (subagent assertions about scope cannot be trusted). Carta failed this gate in batch #13 — Phase 1 subagent had asserted TAM membership but Carta was not on TAM, Factor, or G2 lists.

**v2.4 patch (May 1, batch #13 audit):**
7. Phase 7.5 per-prospect confidence gate — every draft must score **9/10 minimum** across three dimensions (formula compliance, deep research traceability, personalization specificity) before advancing to Phase 8. Below floor: deeper research pass (Sales Nav lead page Experience entries), hook rework to remove unverifiable claims, or drop candidate. Catches the failure mode where formula compliance is 5/5 but personalization is generic-company or built on inference. Batch #13 audit revealed 6.5–9.5/10 variance across drafts — Christophe Brillant's "Rennes engineering chapter" was inference (would have been sent without this gate).

**v2.5 patch (May 1, batch #13 audit follow-up):**
8. Phase 7.5 enhancement loop is now **automatic**. The orchestrator does not present sub-9 drafts to Rob to choose a remediation path. When a draft scores <9/10, Path A (deeper research via Sales Nav lead page) runs first; if that doesn't get to 9, Path B (hook rework to verified-only) runs; if that still fails, Path C (drop candidate, backfill from Phase 3 queue) runs. By Phase 8 presentation, every draft is 9+/10 by construction. Rob's directive: "make the enhancement process happen automatically".

**v2.6 patches (May 1, batch #13 send loop — comprehensive end-to-end):**
9. Phase 0.7.5 deliverability pre-check (NEW) — flag candidates with connections < 50 AND/OR followers < 50 as deliverability risk. Drop those with connections < 20 AND followers < 20 outright (near-guaranteed INC-030 burn). Send remaining ⚠️ flagged candidates LAST in the Phase 9 loop so credits aren't burned before solid sends complete.
10. Phase 9 friction handling subsection — explicit recovery procedures for compose dialog won't open, "Leave site?" dialog blocking nav, INC-030 send error, INC-029 compose hang, INC-027 multi-match recipient.
11. INC-030 stop-loss rule (NEW hard rule) — max 1 retry per failed send. If retry fails identically, drop + DNC. NEVER attempt a 3rd send. Each attempt burns a credit.
12. Per-send credit accounting (NEW mandatory log) — track pre/post-send credit count per send to detect charge-without-delivery in real time.
13. End-of-loop reconciliation (NEW mandatory log) — total used vs total delivered; non-zero credits-lost triggers post-mortem.

---

## Phase order (mandatory, v3.3)

```
Phase 0:    Read context (handoff, CLAUDE.md, MASTER_SENT_LIST, this playbook)
Phase 0.4:  TAM CSV load (NEW v3.3, MANDATORY) — main-context read tam-accounts-mar26.csv + g2-intent
Phase 0.5:  DNC cross-check (v2.1) — grep CLAUDE.md DNC list, build exclusion set
   ↓
Phase 1:    Account survey (BOUNDED POOL v3.3) — TAM 312 ∪ G2 authorized 6, no exceptions
            — broaden to 8-10 accounts when network density / Factor-coverage is high
   ↓
Phase 1.5:  TAM-scope verification (v2.3) — MAIN-CONTEXT grep tam-accounts + g2-intent
            — drop accounts not on TAM/Factor/G2
   ↓
Phase 2:    Apollo prospecting per account (free) — MAIN-CONTEXT ONLY
            — v3.2 pre-filter: weight verbose/specific Apollo titles + long employment_history
              higher (proxy for likely-rich Sales Nav About)
   ↓
Phase 2.5:  LinkedIn pre-screen (v2.7, CHEAP) — Chrome MCP capture each candidate's public profile
            ├─ MASTER_SENT_LIST grep (Phase 0.6 part A — drop prior-sent)
            ├─ LinkedIn-degree gate (Phase 0.7 — drop 1st-degree → DM batch)
            ├─ Deliverability pre-check (Phase 0.7.5 — drop conn<20 AND followers<20)
            └─ Activity capture (feeds Phase 4 hook tier classification)
   ↓
Phase 3:    Apollo people_match dedup gate — MAIN-CONTEXT ONLY, MANDATORY (only on 2.5 survivors)
   ↓
Phase 0.6b: LinkedIn DM thread search (v2.2) — Chrome MCP messaging inbox search
   ↓
Phase 4:    Sales Nav lead-page DEEP research per candidate (v3.0 MANDATORY FIRST, HARD GATE v2.8)
            REQUIRED non-empty fields: live_headline, connection_degree, activity_status,
            evidence_quote_for_hook, about_section, current_role_description, skills_top5,
            recent_activity_full, sales_nav_banner_title, sales_nav_tenure.
            Apollo is NEVER a fallback. Drop on 2× retry capture failure.
   ↓
Phase 4.5:  Programmatic depth audit — schema-only fills do not pass v3.0
   ↓
Phase 5:    Per-candidate file persistence (Gate 6.5) — includes evidence_file pointer
   ↓
Phase 5.5:  Pre-Phase-6 evidence-file resolve check — broken pointer blocks drafting
   ↓
Phase 6:    Draft v3 (Standard SOP voice) anchored to verified facts
   ↓
Phase 7:    Hook upgrade pass (v3 → v4) using deep-research findings
   ↓
Phase 7.5:  Per-prospect confidence gate (v2.4 + v2.5 auto-loop) — 9/10 floor
            D2 floor (v3.2): tenure-only 8/10 acceptable ONLY when ABOUT-EMPTY +
            LINKEDIN-QUIET + NO current_role_description are all verified.
            Auto-loop A → B → C: deeper research → hook rework → drop+backfill.
            No sub-9 drafts presented to Rob.
   ↓
Phase 8:    QA Gate + present to Rob for APPROVE SEND
            Tracker MUST surface Evidence file path + verbatim Quote column per candidate
   ↓
Phase 9.0:  Pre-send thread re-verify (v3.1 NEW) — re-run LinkedIn inbox thread search
            for ALL roster names IMMEDIATELY before send loop starts
   ↓
Phase 9:    Send loop — Sales Nav search-and-icon-click path (v2.9 locked selectors)
            INC-022 readback + INC-024 MASTER append per send
            Open Profile FREE save detection (v3.2): "Free to Open Profile" badge = no credit
            Sales Nav search auto-correct fallback (v3.2 Friction 9): if 0 results, public profile
            Friction handling: INC-029 hung tab, INC-030 stop-loss, INC-027 multi-match
   ↓
Phase 9.5:  Chrome MCP friction recovery (v2.9) — fresh tab group when compose hangs
```

---

## NEW MANDATORY GATE: Apollo Dedup Signal (locked Apr 30, batches #9-#11)

**Rule:** Before drafting any InMail, every candidate must pass `apollo_people_match` clean check.

**The dedup signal:** `emailer_campaign_ids` field in the Apollo Contact record.
- `[]` (empty) = CLEAN ✅
- `["69afff8dc8897c0019b78c7e"]` (Factor-First campaign ID) = DIRTY ❌ DROP
- Any non-empty array = DIRTY ❌ DROP unless Rob explicit override

**Critical: MASTER_SENT_LIST grep alone is INSUFFICIENT.** Factor-First auto-enrolls Top-10 TAM Director/VP contacts, so contacts can be actively in a campaign without ever appearing in MASTER_SENT_LIST.

**Strategic finding (batches #9 + #11):** Drop rate when filtering by MASTER_SENT_LIST alone vs. Apollo dedup:
- Batch #9 first pass: 9 candidates → 4 dropped (44% Factor contamination) → 5 confirmed clean
- Batch #10 first pass: 5 candidates → 0 dropped (100% clean — applied lesson upfront)
- Batch #11 first pass: 8 candidates → 3 dropped (37% Factor contamination on healthcare retries)

**Pattern that survives the Factor wall:** Sr Director > Director > VP for cleanness. International locations (Amsterdam, Israel, Manila, UK, Canada) > US-based. Distinctive/specialized titles ("Director Eng - Infrastructure", "Director Cloud", "Sr Director & AMS Site Manager") > generic ("VP of Engineering").

**Healthcare/wellness TAM accounts heavily Factor-First covered:** Tandem Diabetes, Mindbody, HHAeXchange (most contacts), Veradigm. To uplift Healthcare in batch #12+: drop tier to Sr Manager / Manager Eng, OR pivot to Conference Outreach sequence, OR Rob explicit Factor override.

**The clean Apollo state lookup:**
```javascript
// In apollo_people_match response, look for these fields in `contact` sub-object:
contact.emailer_campaign_ids === [] // CLEAN signal
// OR no `contact` field at all (person not in Apollo Contacts) = CLEANEST
// OR contact exists with csv_import source + Robert_TAM_Oct25 custom_field + null last_activity_date = CLEAN ("uploaded but never campaigned")
```

**False-clean traps:**
- Apollo `headline` field showing different role than `title` field — example: Himanshu Sharma @ HashiCorp had Apollo `title: "Director of Engineering"` but `headline: "Sr. Support Cloud Engineer 2 (Lead) | Hashicorp 4x Certified..."` — DROP for persona mismatch
- Custom field tags like "Factors_19thJune25_Vishwanath_Valid" or "Factors_BDRs" without an active emailer_campaign_ids — borderline, prefer to drop conservatively

---

## NEW MANDATORY GATE: Sales Nav / Public LinkedIn Deep Research (locked Apr 30, batch #11)

**Rule:** Before any draft moves from Tier A draft-form to send-ready, every candidate must have a Sales Nav or public LinkedIn profile capture with main-context Chrome MCP `get_page_text`.

**What to capture per candidate:**
1. Banner title / current title (verbatim)
2. Headline (verbatim, if different from banner)
3. About section (if present)
4. Recent activity feed — posts, reposts, comments (90-day window minimum)
5. Mutual connections with Rob (if any — surfaces stronger touchpoint)
6. Education + location
7. Connection degree (1st, 2nd, 3rd) — 1st-degree = use DM not InMail (free)

**Why this matters:** Apollo data captures `title` + `employment_history` but does NOT capture recent LinkedIn activity. The strongest InMail hooks are anchored to specific verifiable engagement (e.g. "I saw you reposted X 3 weeks ago"). Without deep research, hooks are limited to tenure-anchored generalities.

**Hook tier system (v4 locked Apr 30):**
- **Tier A++** = recent activity directly adjacent to our pitch (Santanu's #aitesting podcast repost)
- **Tier A+** = recent activity confirming a topical macro shift (Mark's MCP Server repost, Christopher's HCP Terraform repost)
- **Tier A** = LinkedIn-quiet but verified Apollo career-tenure facts (Peter's 12y Infor tenure, Andrew's 10y DraftKings career-grown)
- Tier B and below: NOT acceptable — drop or rewrite

**Strategic finding (batch #11):** 3 of 5 picks went from Tier A → A+/A++ when deep research ran. The deep-research delta was the difference between confidence 95.6% (v3) and 97.2% (v4).

---

## NEW LOCKED RULE: Activity-Based Hooks > Tenure-Based Hooks (where available)

**When recent LinkedIn activity exists, anchor the hook to specific verifiable engagement:**
- "I saw you reposted [X] [Nmo] ago" → strongest
- "Your team is building [Y]" → if confirmed by hiring posts / reposts
- "[Macro shift] you're owning at [company]" → if confirmed by their role description

**When LinkedIn-quiet (no posts, no reposts in 90 days), anchor to verified Apollo career-tenure:**
- "Twelve years at Infor" → solid, factual
- "Almost a decade in and a year into the new Director chapter" → solid, factual
- "Five years in through the IBM chapter" → solid, factual

**NEVER fabricate recent activity.** If they're LinkedIn-quiet, the draft says so honestly via tenure-anchor.

---

## NEW LOCKED RULE: INC-027 Common Names (locked Apr 30, batch #11 Peter Storey lesson)

**Multi-match handling:** Sales Nav search for common names (Peter Storey, Mark Smith, Sarah Chen) can return 2+ matches. INC-027 strict aria-label check requires:

1. Read the subhead under each result name
2. Match the subhead to the candidate's verified Apollo title + company
3. Click ONLY the result whose subhead matches verbatim
4. NEVER click "first result" by default — verify match first

**Example caught Apr 30:** "Peter Storey" search returned:
- Result 1: "Peter Storey · Director of Software Engineering at Infor" ✓ correct
- Result 2: "Peter Storey · Staff Writer at Information Inc." ✗ wrong

Correct selection saved a wrong-target send (would have been INC-027 violation).

---

## RECOVERY PROTOCOL: Chrome MCP unresponsive on Sales Nav compose (logged as INC-029)

**Symptom:** Chrome MCP tools (computer:left_click, find, get_page_text, screenshot) time out after the first action on Sales Nav compose page. tabs_context_mcp still works. Browser appears "connected but page operations time out".

**Cause:** Sales Nav compose page never reaches `document_idle` state — async loading of side panel data (Strategic Priorities, Insights) keeps document in non-idle indefinitely.

**Recovery:**
1. Call `tabs_create_mcp` to make a new tab
2. Navigate the new tab to `https://www.linkedin.com/sales/inbox`
3. Wait 4 seconds, screenshot to verify state
4. Use `tabs_close_mcp` to close the stuck old tab
5. Resume work on the new tab

**Tested Apr 30 batch #11:** Recovery worked first try. New tab loaded cleanly, all 5 sends executed normally on the fresh tab.

**If recovery fails:** Stop and ask Rob to manually intervene per CLAUDE.md ("If any browser operation fails (popup blocked, OAuth redirect, login needed), STOP and tell Rob what needs to be clicked. Do NOT attempt programmatic workarounds for browser-level issues.")

---

## SEND LOOP PROTOCOL (unchanged but logged here for completeness)

Per send:
1. Click "Compose new message" pencil icon
2. Click recipient search field
3. Type "{First} {Last} {Company}" — never just name (avoids INC-027 disambiguation)
4. Wait 2 seconds, screenshot
5. Verify single match (or click correct match if multiple, per INC-027)
6. JS inject subject + body via React-compatible setter:
   ```javascript
   const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
   inputSetter.call(subjectInput, subjectText);
   subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
   const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
   textareaSetter.call(bodyArea, bodyText);
   bodyArea.dispatchEvent(new Event('input', { bubbles: true }));
   ```
7. INC-022 readback: verify `bodyEnd` ends with verbatim "...?\n\nBest,\nRob"
8. Click Send button
9. Wait 2 seconds, screenshot — verify thread shows "Awaiting reply from {Name}"
10. INC-024 MASTER_SENT_LIST append per send (mandatory gate)

---

## NEW MANDATORY GATE: Phase 0.5 DNC cross-check (locked May 1, 2026 — batch #12 dry run)

**Rule:** Before any sourcing, build a Do Not Contact exclusion set from CLAUDE.md.

```bash
grep -A 1000 "## Do Not Contact List" CLAUDE.md | grep "^|" | tail -n +3
```

**Why this gate exists:** In the batch #12 dry run (May 1), a general-purpose subagent surfaced **Peter Rimshnick @ Yext** as a candidate. Peter has been on the DNC list since Mar 22, 2026 (replied "Unsubscribe" to T2 in Batch 8). The Apollo dedup gate did NOT catch this because DNC is enforced by us, not Apollo — once a contact is taken out of an active campaign, they look "clean" to apollo_people_match.

**Behaviour:** If a Phase 1 account or Phase 2 candidate matches the DNC list (full name match OR email-domain match OR "Name @ Company" pair), drop silently and note in the batch tracker. DNC entries take precedence over Apollo state.

---

## NEW MANDATORY GATE: Phase 7.5 Per-prospect confidence gate (locked May 1, 2026 — batch #13 audit)

**Rule:** Every draft must score **9/10 minimum** across three dimensions before advancing to Phase 8 APPROVE SEND.

### Three-dimensional rubric

**D1 — Formula compliance** (binary, all 10 must pass):
1. Lowercase "its" in opener (intentional)
2. Verbatim opener
3. Verbatim "Reason I'm asking, when…" connector
4. Verbatim proof point — CRED 90%/5x OR Medibuddy 50%/2,500 OR Nagra DTV 2,500/4x (pick by vertical match)
5. Verbatim Testsigma's Agent capability paragraph
6. Verbatim curious close
7. `Best,\nRob` sign-off (no em dash)
8. Subject 4-10 words, no em dashes
9. No em dashes in body
10. Body char count in target range (~1000-1100 InMail / 640-840 DM)

**D2 — Deep research traceability** (claim-by-claim):
- Every concrete claim must trace to Apollo employment_history / Apollo organization keywords / Apollo location / captured LinkedIn page line.
- Verified = ✅, Inferred = ⚠️, Fabricated = ❌ auto-fail.
- Score: 10/10 = all Verified; 9/10 = 1 Inferred; ≤8/10 = 2+ Inferred → REWORK or DROP.

**D3 — Personalization specificity:**
- 10/10 = recipient-specific anchors throughout
- 9/10 = ≥1 recipient-specific anchor + verifiable tenure/role frame
- 8/10 = generic-company hook with verified tenure only (Tier A LinkedIn-quiet floor — was acceptable in v2.3 but tightened in v2.4)
- ≤7/10 = generic OR inference where verification was possible → REWORK or DROP

**Overall confidence = min(D1, D2, D3).** Fail if any dimension <9.

### Auto-enhancement loop (v2.5 — runs automatically when score <9/10)

The orchestrator does NOT ask Rob which path to take. It runs Path A → B → C in order, automatically.

```
for each draft in batch:
  score = audit(draft)
  if score >= 9: continue           # ✅ pass

  # Path A — deeper research via Sales Nav lead page
  evidence = sales_nav_capture(candidate)
  if evidence.has_new_anchor:
    rewrite_hook(draft, evidence)
    if audit(draft) >= 9: continue

  # Path B — hook rework to verified-only
  rewrite_to_tier_a_floor(draft, candidate.verified_facts)
  if audit(draft) >= 9: continue

  # Path C — drop + backfill
  drop(candidate)
  backfill = next_phase3_clean(account_diversity_weighted=true)
  if backfill is None:
    halt_loop()                     # roster shrinks; never fill with weak picks
    break
  run_gates(backfill)               # 0.6 + 0.7 + 4
  draft = compose(backfill)
  # re-enter loop
```

**Path A — deeper research:** navigate Chrome MCP to `linkedin.com/sales/lead/{urn-or-search}/`, capture full Experience tab + About section. Look for any recipient-specific anchor not in Apollo (project, team focus, exact start date, recent shipped feature). Re-anchor hook.

**Path B — hook rework:** strip every unverifiable claim. Anchor opener to only Apollo-verified facts (tenure / role / location / tech stack). Tier A floor — verified-tenure-only opener — minimum hits 9/10 because tenure is recipient-specific AND verified.

**Path C — drop + backfill:** drop candidate, log failure dimension, pull next-strongest Phase 3-clean candidate from queue (prefer different account for diversity). Run all gates on backfill before drafting. Re-enter the audit loop on the backfill. If queue empty, halt with N strong picks.

### What Rob sees at Phase 8

By the time Phase 8 presents, every draft is ≥9/10. The Phase 8 view includes:
- Per-prospect score (D1 / D2 / D3 / overall)
- Hook tier (A / A+ / A++)
- Audit log per draft that went through the loop ("Christophe — Path A surfaced 2024-09 start, hook re-anchored, now 9.5/10")
- Drop + backfill log if any candidates were replaced

Rob never chooses between sending a sub-9 or remediating. The skill has already remediated.

### Confidence floor by hook tier (v2.4)

| Tier | Floor |
|---|---|
| A (LinkedIn-quiet, tenure-anchored) | 9/10 (was 8.5 in v2.3) |
| A+ (recent activity confirms macro) | 9.5/10 |
| A++ (recent activity directly adjacent to pitch) | 9.5/10 |

### Why this gate exists (batch #13 audit)

The batch #13 first-pass drafts hit 5/5 formula compliance and avg 93.2% confidence — but per-draft audit revealed wide variance:
- Sukhmeet Toor: 9.5/10 (Tier A++ activity-anchored)
- Titan Yim: 9/10 (verified role move + verified tech stack)
- Anoop Gupta: 9/10 (verified tenure + verified tech stack)
- Jeff Biggs: 8/10 (generic-TQL framing, LinkedIn-quiet limit)
- Christophe Brillant: 6.5/10 (Rennes-lab buildout was inference, not verified)

Without Phase 7.5, Christophe's inference would have been sent. Rob caught it on review. The gate now forces this audit programmatically every batch.

---

## NEW MANDATORY GATE: Phase 1.5 TAM-scope verification (locked May 1, 2026 — batch #13 part 2)

**Rule:** After Phase 1 survey but BEFORE any Apollo credit is spent, the orchestrator (NOT a subagent) must grep `tam-accounts-mar26.csv` AND `sequences/g2-intent/` for each surfaced account. Any account not on at least one list is dropped from the batch.

```bash
grep -i "{Company}\|{domain}" tam-accounts-mar26.csv
grep -i "{Company}" sequences/g2-intent/*.md
```

If either grep matches → in scope, proceed to Phase 2.
If neither matches → drop the account. Do NOT spend Apollo credits.

**Why this gate exists (batch #13 dry run, part 2):** The Phase 1 subagent surfaced 8 candidate accounts including Carta. After Phase 2/3/0.6/0.7 cleared Aditya Mantri @ Carta as a valid candidate, a TAM-scope check showed **Carta is not on TAM, not on Factor, not on G2**. The subagent had simply asserted "all 8 accounts cleared" without verifying. **Same fabrication-risk pattern as v2.1 caught for Apollo work** — subagent claims that look reasonable but aren't traceable to actual data reads.

**Subagents may still do Phase 1 sourcing** — the survey itself is fine to delegate. But the orchestrator must verify TAM membership of the surfaced accounts before any Apollo credit is spent.

**Cost:** ~5 seconds per account (one Grep call per account). For 8 accounts, ~40 seconds total. Cheap insurance.

---

## NEW MANDATORY GATE: Phase 0.6 Prior-contact check (locked May 1, 2026 — batch #13 part 1)

**Rule:** After Phase 3 dedup but BEFORE Phase 0.7 degree gate, every Apollo-clean candidate must pass two checks. Both must be clean.

### Part A — MASTER_SENT_LIST grep

```bash
grep -i "first.last\|first last" MASTER_SENT_LIST.csv
```

If any row matches, drop the candidate. Prior outreach exists via some channel (T1/T2 email, conference, inbound, prior InMail/DM batch). Re-engaging without context is risky.

### Part B — LinkedIn DM thread search

In the work browser via Chrome MCP:

1. Navigate to `https://www.linkedin.com/messaging/`
2. `find` the "Search messages" input
3. `form_input` candidate's full name
4. `key` Return → wait 3s → `get_page_text`
5. **Decision:** If conversation list shows only the Sponsored ad (no candidate-name match), THREAD CLEAN. If any non-sponsored row matches, THREAD EXISTS → DROP.
6. Clear search before next candidate.

**Why this gate exists (locked May 1, 2026 — batch #13 dry run):** A 1st-degree LinkedIn connection means Rob and the candidate accepted a connection request at some point. That's fine — the network is large. But Rob may also have an active or stale DM thread, in which case sending another cold-style InMail or net-new DM is wrong. The Apollo dedup gate cannot see LinkedIn DM history. The DNC list catches explicit opt-outs but not "we've talked before, just need to pick up where we left off." This gate closes that blind spot.

**Why we don't use the candidate's profile page:** The Message button on a 1st-degree profile always renders, regardless of whether a thread exists. The inbox search is the only programmatic way to confirm thread state without clicking through.

**Cost:** ~10 seconds per candidate.

**Applies to DM batches too.** When routing 1st-degree spillover to a DM batch, run Phase 0.6 first. If a thread already exists, the DM is a follow-up not a cold open — surface to Rob and let him decide whether to reply in-thread or skip.

**Batch #13 dry run validation:** All 5 1st-degree candidates (Brett, Aditya, Naveen, Arnold, Dani) passed both Phase 0.6 checks — no MASTER_SENT_LIST entries, no existing LinkedIn DM threads. So they are valid DM-batch targets (cold opens to existing connections), not in-thread follow-ups.

---

## NEW MANDATORY GATE: Phase 0.7 LinkedIn-degree gate (locked May 1, 2026 — batch #12 dry run)

**Rule:** After Phase 3 dedup but BEFORE Phase 4 deep research, navigate Chrome MCP to `https://www.linkedin.com/in/<slug>/` for every Apollo-clean candidate and read the connection degree from the page.

| Degree | Action |
|---|---|
| 1st | DROP from InMail batch — route to a separate DM batch |
| 2nd | KEEP in InMail batch (some are Open Profile → free InMail anyway) |
| 3rd | KEEP in InMail batch |

**Why this gate exists (batch #12 dry run, May 1):** Yext + WorkWave produced 7 Apollo-clean Director/VP candidates. Phase 4 deep research caught **4 of 7 as 1st-degree connections** (Michael Butrym, DJ O'Brien, Adam Dyer, Daniel Lischak). All 4 were in Rob's existing network and would have wasted InMail credits if sent. Apollo dedup doesn't track LinkedIn connection state, so the degree check has to be its own gate.

**Cost:** ~30 seconds per candidate (one Chrome MCP `get_page_text` call).

**Apollo `linkedin_url` field is the source of truth for the slug.** Slugs like `linkedin.com/in/matthew-hupman/` may 404; the real slug is `matthew-hupman-19b72250`. If the Apollo response doesn't have the slug, re-call `apollo_people_match` (1 credit) — do NOT guess.

**1st-degree spillover handling:** Persist 1st-degree drops to `batches/active/linkedin-inmail-<MMMDD>-batch<N>/dm-spillover.md`. Recommend a follow-up DM batch for them in the Phase 8 presentation.

**Pattern to expect:** Network density is high in Yext + WorkWave (Rob has built relationships there over time). Plan for a 40-60% drop rate at this gate when the batch overlaps those clusters. Use Phase 1 broaden-survey to compensate.

---

## NEW LOCKED RULE: Phase 2/3 main-context only (locked May 1, 2026 — batch #12 dry run)

**🚨 Apollo prospecting and dedup work runs in the orchestrator only. Subagents must NOT call any Apollo tool.**

**Why (batch #12 dry run, May 1):** A general-purpose subagent in batch #12 was given Phase 2 + Phase 3 work. It returned a candidate list with format-correct but unverifiable Apollo IDs, "DIRTY/CLEAN" classifications it couldn't have made (no actual `apollo_people_match` calls were observed), and surfaced a known DNC contact (Peter Rimshnick) as a "candidate". This is the same fabrication failure mode that produced INC-024 (Apr 15) on the LinkedIn batch flow — locked there as CLAUDE.md rule #6: *"No subagent Apollo trust — Apollo data MUST be verified by direct main-context apollo_people_match calls."*

**Subagents may**:
- Run Phase 1 account surveys (TAM CSV reads + MASTER_SENT_LIST grep)
- Analyze files already on disk (per-candidate dossiers, evidence captures)
- Web research where Apollo is not involved

**Subagents must NOT**:
- Call `apollo_mixed_people_api_search`, `apollo_people_match`, `apollo_people_bulk_match`
- Call any Apollo write tool (`apollo_contacts_create`, etc.)
- Generate or invent Apollo IDs in their output

---

## NEW LOCKED RULE: Phase 1 broaden-survey when network density is high (locked May 1, 2026)

**Default Phase 1 survey size:** 6 accounts.

**Broaden to 8–10 accounts when:**
- Healthcare / Wellness / Fintech verticals are in the requested mix (heavy Factor-First coverage)
- Verticals overlap with Rob's existing customer relationships (Yext, WorkWave-style clusters with high 1st-degree density)
- Prior batch hit >50% combined drop rate at Phase 3 + Phase 0.7 gates

**Why (batch #12 dry run, May 1):** Surveyed 6 accounts, only 4 produced Apollo-clean candidates (Yext, WorkWave, Everbridge, Dynasty). Of those, Yext + Checkr + Rimini hit 80% Factor-First contamination, and Yext + WorkWave hit 57% 1st-degree connection density. Net: 11 candidates dedup-checked, 7 Apollo-clean, 3 InMail-eligible — short of the 5-target. With 8-10 accounts surveyed upfront, the funnel would have produced 5+ InMail-eligible without a mid-batch reroll.

---

## PIPELINE STATE TRACKING (May 1, 2026)

**Cumulative through Apr 30:**
- Batch #6: 2 sent
- Batch #7: 10 sent
- Batch #8: 9 sent
- Batch #9: 5 sent
- Batch #10: 5 prepped (awaiting APPROVE SEND as of Apr 30)
- Batch #11: 5 sent
- Subtotal Apr 30: 31 InMails

**May 1 dry run:**
- Batch #12: 0 sent (halted at Phase 8 per Rob's "stop at approve to send" directive on the v2.0 dry run). 3 InMail-ready drafts staged.

**Process maturity arc:**
- Batches #6-#7: Apollo enrich + Sales Nav at composer-search time only
- Batch #8: Added Gate 6.5 per-candidate file persistence
- Batch #9: Added Apollo dedup signal gate (after 44% Factor contamination drop)
- Batch #10: 100% Apollo-clean by applying batch #9 lesson upfront
- Batch #11: Added mandatory Sales Nav / public LinkedIn deep research per candidate. Avg confidence 97.2% (highest ever).
- **Batch #12 dry run (v2.1 lock):** Caught subagent leakage, 1st-degree blind spot, DNC blind spot, and naive backfill behaviour. Patched skill to v2.1.

**For batch #14+:** All v2.6 gates are mandatory (v2.1 gates + Phase 0.6 + Phase 1.5 + Phase 7.5 + Phase 0.7.5 deliverability + Phase 9 friction handling + INC-030 stop-loss + per-send credit accounting).

**Batch #13 dry run (v2.2/v2.3/v2.4 lock):** Caught the v2.1 gates working perfectly (DNC, main-context, broaden-to-8) plus 100% 1st-degree drop at Phase 0.7. Surfaced three further gaps over the day: prior-contact check (locked Phase 0.6, v2.2), TAM-scope verify (locked Phase 1.5, v2.3), and per-prospect confidence gate (locked Phase 7.5, v2.4). v2.4 caught Christophe Brillant's "Rennes engineering chapter" inference — would have shipped without the gate.
