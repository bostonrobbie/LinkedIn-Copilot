---
name: inmail-batch-v2
description: Build, dedup, research, draft, QA-gate, and send a Sales Navigator InMail batch end-to-end for Rob Gorham (BDR at Testsigma). Use this skill whenever Rob says any of "next InMail batch", "build batch #X", "prep the next batch of N", "let's do another InMail batch", "new InMail batch", "prep me a batch", "send N InMails", or anything that implies sourcing fresh Director/VP Engineering contacts at TAM/G2 accounts and pushing them through the InMail pipeline. Trigger this skill even if Rob doesn't explicitly say "InMail" but is clearly continuing the daily/weekly InMail batch motion (e.g., "lets work on the next batch", "do the next 5", "another batch please"). The skill enforces: DNC cross-check, Apollo dedup gate, LinkedIn-degree gate, MANDATORY LinkedIn evidence file per candidate (no Apollo fallback), activity-based hook tier system, and the per-send INC-022 readback + INC-024 MASTER append protocol.
---

# InMail Batch v3.4 — End-to-End Workflow

**Locked May 4, 2026 (v3.4)** — Full-profile read mandate. Phase 4 must read the WHOLE LinkedIn profile per candidate, not just the header / activity feed visible on initial page load. Per Rob's directive at batch #16: "I don't just want LinkedIn header research, I want it to read the whole profile." The mandatory capture target now includes verbatim About section, full Experience entries (not just current title), Skills (top 5+), Education, Recommendations, Featured posts, AND the 90-day activity feed.

**Programmatic capture gate (v3.4):** For each candidate, after navigating to the public profile, run:
1. `window.scrollTo(0, document.body.scrollHeight)` — scroll to bottom to force lazy-loaded sections
2. Wait 4–6 seconds for content to render
3. `document.body.innerText` extraction with high char limit (>20,000 chars)
4. Verify the captured text contains all required section headers ("About", "Experience", "Skills", "Education", "Activity"). If any are missing, the capture is INCOMPLETE — retry once with longer wait, then escalate to Sales Nav lead-page navigation.

**Public profile restriction handling:** 3rd-degree contacts may have About/Experience/Skills hidden by LinkedIn even after scroll-to-bottom. In that case, the orchestrator MUST navigate to the Sales Nav lead page directly via the Chrome MCP (Rob's work Chrome is authenticated to Sales Nav Premium):

1. Use Chrome MCP `navigate` to `linkedin.com/sales/search/people` with the candidate's name + company as query
2. Use Chrome MCP `find` to locate the lead's name link in the search result
3. Use Chrome MCP `computer` action with `left_click` on the ref to open the lead page
4. Wait 4-6s for the lead page to load
5. Scroll to bottom programmatically (`javascript_tool`) to force lazy-loaded sections
6. Use `get_page_text` or `javascript_tool` to capture About + Experience + Skills + Education + Featured + Activity + Strategic Priorities verbatim
7. Populate the evidence-linkedin/<slug>.md file with all v3.4 required fields

Apollo data is NEVER a fallback for missing LinkedIn sections — that v2.8 hard gate stays in force. The Chrome MCP Sales Nav navigation is the authorized fulfillment path; no separate scraper or Rob-side script needed.

**Phase 4.5 depth audit (strengthened v3.4):** Each evidence file must have non-empty:
- about_section (verbatim quote, ≥1 sentence)
- current_role_description (verbatim from Experience entry, NOT just the headline)
- prior_role_summary (key prior employer + title + duration, from Experience subsection)
- skills_top5 (verbatim from Skills section)
- education_summary (school + degree)
- featured_summary (any featured posts/articles/projects, if present)
- recent_activity_full (90-day window)
- live_headline + connection_degree + sales_nav_banner_title

If any field is empty AND the section was visible on the profile, the capture is FAILED → drop candidate to backfill. Schema-can-be-satisfied-by-30-second-capture is the regression v3.0 caught and v3.4 closes for real.

**v3.3 → v3.4** (May 4, batch #16 second-look): Rob caught that v3.3 evidence files had `about_section: Not in capture` for all 4 picks. The schema required the field but the orchestrator was satisfying it with "not captured" notes rather than actually scrolling the page. v3.4 makes scroll-to-bottom + verbatim About/Experience prose mandatory, with explicit Sales Nav fallback when public is restricted.

**Locked May 4, 2026 (v3.3)** — TAM-bounded sourcing made unambiguous. Per Rob's directive batch #16: the candidate-account pool is BOUNDED by `tam-accounts-mar26.csv` (312 accounts) ∪ `sequences/g2-intent/` (6 G2-authorized accounts). No exceptions. No "this account fits the vertical" inference. No accounts surfaced by Apollo search alone. Phase 0.4 NEW — explicit TAM-CSV load step before any account survey work begins. Phase 1 BOUNDED POOL rule made directive (was descriptive). Phase 1.5 TAM-scope verify is reaffirmed as a hard gate, not advisory. Why locked: skill v3.2 had Phase 1 "Inputs: TAM list (312 accounts), G2 authorized list (6 accounts)" as descriptive prose. Rob caught the ambiguity at batch #16 sourcing-time and asked for explicit enforcement. v3.3 closes the loophole that would let an orchestrator surface a non-TAM account based on vertical-fit reasoning.

**v3.2 → v3.3** (May 4, batch #16 sourcing): Phase 0.4 NEW — TAM CSV is loaded into context BEFORE Phase 0.5 DNC. Phase 1 reworded from "Inputs: TAM list..." to "BOUNDED POOL: candidates MUST come from TAM CSV ∪ G2 authorized. No exceptions." Phase 1.5 verbiage strengthened from "verify the account is TAM, Factor, or G2-authorized" to "any account whose domain is not present in tam-accounts-mar26.csv OR sequences/g2-intent/ is dropped — no exceptions, no override path."

**Locked May 1, 2026 (v3.2)** — Open Profile detection + Sales Nav search-fallback + tenure-only D2 floor clarification. Batch #15 send loop surfaced four practical gaps in v3.1's documentation: (a) Sebastian Thierer's send didn't deduct a credit (Open Profile FREE), but the "credit text not found" return value looked like a failure signal; (b) Pablo Sortino's Sales Nav search auto-corrected "Stori" → "story" returning 0 results, forcing fallback to public profile (skill didn't have a procedure); (c) Alon Dissentshik's profile genuinely had no About + LinkedIn-quiet activity — the v3.0 D2 8/10 cap should be acceptable as a floor in this case but the skill didn't articulate when; (d) v3.0 forced 4 of 5 hooks at AI-anchored A+/A++ tier, materially better than v2.x averages — the prep step (filtering Phase 2 candidates for likely-rich-About profiles) wasn't in the skill.

**v3.1 → v3.2** (May 1, batch #15 send loop, post-send): NEW Open Profile section explaining "Free to Open Profile" badge detection. NEW Friction 9 — Sales Nav search auto-correct fallback. NEW Phase 7.5 D2 clarification — tenure-only 8/10 floor is acceptable when ABOUT-EMPTY + LINKEDIN-QUIET + NO current_role_description are all genuinely verified. NEW Phase 2 pre-filter heuristic — favor candidates whose Apollo title is verbose/specific (proxy for likely-rich Sales Nav About).

**Locked May 1, 2026 (v3.1)** — pre-send thread-state re-verification gate. Phase 0.6 prior-contact checks (MASTER grep + DM/InMail thread search) run at sourcing-time. v3.1 adds Phase 9.0 — a fresh repeat of the LinkedIn inbox thread search RIGHT BEFORE the send loop starts, catching any thread that may have been created between sourcing and send (replies, forwarded threads, accidental InMail from another session). Time between sourcing and send-time can be hours or days; thread state can change.

**v3.0 → v3.1** (May 1, batch #15 send loop): Phase 9.0 NEW — pre-send thread-state re-verification gate. Sourcing-time Phase 0.6 alone is insufficient if hours/days pass before send. Re-run inbox search for all roster names; any non-empty result blocks that candidate's send.

**Locked May 1, 2026 (v3.0)** — depth-mandatory LinkedIn research. Batch #15 surfaced that v2.8/v2.9 evidence-file required fields were structurally shallow: live_headline + degree + activity_status + one quote can all be populated from a 30-second public profile capture. The orchestrator optimized to satisfy the schema, not to do thorough research. Rob caught it: "did we do individual LinkedIn research?" v3.0 makes deep Sales Nav lead-page capture (About + Experience-entry prose + skills + full activity) MANDATORY for every candidate, not a fallback. Tenure-only hooks now incur a D2 penalty so the orchestrator must find substantive material in About or Experience for LinkedIn-quiet candidates instead of falling back to "X years at Y company" generic.

**v2.9 → v3.0** (May 1, batch #15 post-pause): Phase 4 reordered so Sales Nav lead-page capture is REQUIRED FIRST (not a fallback). Public profile is now the supplement. Evidence file gains 4 new required non-empty fields (about_section, current_role_description, skills_top5, recent_activity_full). Phase 4.5 depth audit is programmatic. Phase 7.5 D2 rubric: tenure-only hooks max at 8/10 — forces deeper research or drop.

**v2.8 → v2.9** (May 1, batch #14 send loop, post-mortem): Phase 9 concrete procedure with locked Sales Nav selectors and coordinates. Phase 9.5 (NEW) — Chrome MCP friction recovery via fresh tab group. Phase 4 evidence file gains `sales_nav_banner_title` and `sales_nav_tenure` fields (banner title is closer to formal title than self-styled public headline).

**v2.7 → v2.8** (May 1, batch #14): NEW Phase 4 hard gate — evidence file persistence + activity-claim verbatim traceability. Phase 7.5 D2 rubric tightened: Apollo can confirm but cannot be the SOLE source; activity claims without a verbatim quote in the evidence file AUTO-FAIL D2.

**v2.6 → v2.7** (May 1, batch #14): Phase 2.5 (NEW) — combined LinkedIn pre-screen runs after Apollo people search but BEFORE `apollo_people_match` dedup. Saves ~70% of Apollo credits in network-dense verticals (SaaS/Tech Director+ Eng).

**v2.5 → v2.6** (batch #13 send loop): Phase 0.7.5 deliverability pre-check, Phase 9 comprehensive friction-handling subsection, stop-loss rule on retries.

**v2.4 → v2.5** (batch #13 audit follow-up): Phase 7.5 failure handling is automatic. The skill never presents a sub-9 draft to Rob. Path A → B → C runs without asking.

**v2.0 → v2.1** (May 1, batch #12 dry run): subagent leakage ban on Apollo work, Phase 0.5 DNC cross-check, Phase 0.7 LinkedIn-degree gate, Phase 1 broaden-survey rule.

**v2.1 → v2.2** (May 1, batch #13 dry run, part 1): Phase 0.6 prior-contact check — MASTER_SENT_LIST grep + LinkedIn DM thread search per candidate. Catches contacts Rob has previously messaged (any channel) or has an active LinkedIn DM thread with, even if Apollo dedup says "clean" and they're not in the DNC list.

**v2.2 → v2.3** (May 1, batch #13 dry run, part 2): Phase 1.5 TAM-scope verification — main-context grep of `tam-accounts-mar26.csv` + `sequences/g2-intent/` for every Phase 1 account. Same fabrication-risk pattern as v2.1 Apollo lock.

**v2.3 → v2.4** (May 1, batch #13 draft audit): Phase 7.5 per-prospect confidence gate. Every draft must score 9/10 minimum across three dimensions before it advances to Phase 8 APPROVE SEND. Drafts below floor get a deeper research pass (Sales Nav lead page Experience entries), a hook rework, or a drop. Catches the failure mode where formula compliance is 5/5 but personalization is generic-company or built on inference rather than verified evidence.

## What this skill does

Runs the complete process to build and ship a Sales Navigator InMail batch:

```
Phase 0:    Read context (handoff, CLAUDE.md, MASTER_SENT_LIST, playbook)
Phase 0.4:  TAM CSV load (NEW v3.3, MANDATORY)      ← main-context read tam-accounts-mar26.csv + g2-intent
Phase 0.5:  DNC cross-check (v2.1, FREE)            ← grep CLAUDE.md DNC table before sourcing
   ↓
Phase 1:    Account survey (BOUNDED POOL v3.3) — TAM 312 ∪ G2 6, no exceptions
            — broaden to 8-10 accounts when network density is high
   ↓
Phase 1.5:  TAM-scope verify (v2.3, FREE)           ← MAIN-CONTEXT grep tam-accounts-mar26.csv + g2-intent
   ↓
Phase 2:    Apollo prospecting per account (v2.1, FREE — search returns names+IDs+titles)
   ↓
Phase 2.5:  LinkedIn pre-screen (NEW v2.7, CHEAP)   ← Chrome MCP capture each candidate's public profile
            ├─ MASTER_SENT_LIST grep (Phase 0.6 part A — drop prior-sent)
            ├─ LinkedIn-degree gate (Phase 0.7 — drop 1st-degree → DM batch)
            ├─ Deliverability pre-check (Phase 0.7.5 — drop <20 conn AND <20 followers)
            └─ Activity capture (feeds Phase 4 hook tier classification)
   ↓
Phase 3:    Apollo dedup gate (MAIN-CONTEXT, EXPENSIVE — 1 credit each, only on Phase 2.5 survivors)
   ↓
Phase 0.6b: LinkedIn DM thread search (v2.2)        ← Chrome MCP messaging inbox search
   ↓
Phase 4:    LinkedIn deep research (HARD GATE v2.8) — evidence-linkedin/<slug>.md per candidate
            REQUIRED FIELDS NON-EMPTY: live_headline, connection_degree, activity_status,
            evidence_quote_for_hook. NO Apollo fallback. Drop if capture fails 2× retry.
   ↓
Phase 5:    Gate 6.5 per-candidate file persistence (NEW v2.8: includes evidence_file pointer)
   ↓
Phase 5.5:  Pre-Phase-6 evidence-file resolve check (BLOCKS drafting if any pointer broken)
   ↓
Phase 6:    Draft v3 (Standard SOP voice)
   ↓
Phase 7:    v3 → v4 hook upgrade pass
   ↓
Phase 7.5:  Per-prospect confidence gate (v2.4-v2.5 — 9/10 floor; auto-loop A→B→C below)
   ↓
Phase 8:    QA Gate + present for APPROVE SEND
   ↓
Phase 9:    Send loop — Sales Nav search-and-icon-click path (v2.9 locked)
            INC-022 readback + INC-024 MASTER append per send
            Friction handling: INC-029 hung tab, INC-030 stop-loss, CRM-match dismiss,
            search-result-render scroll trick, fresh-tab-group reset on extension degrade
```

The locked process was finalized across batches #8–#11 on Apr 30 and patched to v2.1 after batch #12 dry run on May 1, 2026.

---

## Phase 0 — Read context first

Before any tool calls, read these files to load the operational state:

- `CLAUDE.md` — sender rule (`robert.gorham@testsigma.com`), TAM/G2 scope, persona, voice, hard rules, **and the Do Not Contact list**
- `memory/session/handoff.md` — yesterday's batch state, credit balance, queued work
- `MASTER_SENT_LIST.csv` — confirm what's already been sent (last ~20 rows is enough)
- `memory/playbooks/inmail-batch-process-v2.md` — the canonical playbook this skill implements

**Halt-vs-continue rule for queued prior batch:** If batch #X-1 is still queued + awaiting APPROVE SEND, surface to Rob and **WAIT for explicit "go"** before starting batch #X. Don't pile up unsent batches. (v2.0 was ambiguous on this — locked v2.1.)

---

## Phase 0.4 — TAM CSV load (NEW in v3.3, MANDATORY)

**Rule:** Before Phase 0.5 DNC cross-check, before Phase 1 account survey, before any subagent dispatch, the orchestrator MUST main-context read `tam-accounts-mar26.csv` (312 accounts) AND survey `sequences/g2-intent/` (6 G2-authorized accounts). This is the BOUNDED candidate-account pool.

**No candidate account may enter Phase 1 unless its domain (or company name) appears in one of these two sources.** A candidate that "fits the vertical" but is not in TAM CSV or G2-authorized is OUT OF SCOPE — drop without further evaluation.

```bash
# Mandatory main-context reads at Phase 0.4
wc -l tam-accounts-mar26.csv          # confirm 313 rows (1 header + 312 accounts)
ls sequences/g2-intent/               # confirm authorized 6
```

**Why this gate exists (locked May 4, 2026 from batch #16 sourcing):** Skill v3.2 had Phase 1 worded as "Inputs: TAM list (312 accounts), G2 authorized list (6 accounts)" — descriptive, not directive. Rob's challenge at batch #16: "make sure the skill knows to pull from TAM accounts." The orchestrator could in principle surface a non-TAM account by vertical-fit reasoning (Apollo search by industry, web research) without the skill explicitly blocking it. v3.3 makes the bounded pool explicit + enforced upfront.

**Behaviour:** If Phase 1 surfaces an account whose domain is not in `tam-accounts-mar26.csv` and not in `sequences/g2-intent/`, drop it silently and note in the batch tracker as "out-of-TAM-scope." Phase 1.5 TAM-scope verify is a defense-in-depth check, not the primary boundary.

---

## Phase 0.5 — DNC cross-check (NEW in v2.1)

**Rule:** Before any sourcing, extract the Do Not Contact table from `CLAUDE.md` and prepare a name + domain exclusion set. Pass this to Phase 1 and Phase 2.

```bash
# Pull the DNC list
grep -A 1000 "## Do Not Contact List" CLAUDE.md | grep "^|" | tail -n +3
```

**Why this gate exists (locked May 1 from batch #12 dry run):** A subagent in batch #12 surfaced Peter Rimshnick @ Yext as a candidate. Peter is on the DNC list since Mar 22, 2026 (replied "Unsubscribe" to T2). The Apollo dedup gate would not catch this because the contact may not be in any active campaign — DNC is enforced by us, not Apollo. The v2.0 skill had no Phase 0 DNC check, so DNC contacts could re-surface every batch.

**Behaviour:** If a Phase 1 candidate account or Phase 2 candidate person matches the DNC list (by full name, email domain match, or "Name @ Company" pair), drop silently and note in the batch tracker.

---

## Phase 1 — Account survey

**🚨 BOUNDED POOL RULE (v3.3, locked May 4, 2026):** Candidate accounts MUST come from `tam-accounts-mar26.csv` (312 accounts) ∪ `sequences/g2-intent/` (6 G2-authorized accounts). No exceptions. No "this account fits the vertical" inference. No accounts surfaced by Apollo industry search alone. No accounts pulled from web research. The Phase 0.4 main-context load is the source of truth — do not survey from any other origin.

**Inputs:** TAM list (`tam-accounts-mar26.csv`, 312 accounts) and G2 authorized list (`sequences/g2-intent/README.md`, 6 accounts), already loaded in Phase 0.4.

**Output:** A shortlist of candidate accounts spread across the verticals Rob asks for (default: SaaS/Tech, FinTech, Retail/E-Commerce, Healthcare/Digital Health) — every shortlisted account traces to a row in TAM CSV or to a G2-authorized account.

**Survey size — context-aware (NEW v2.1):**

| Vertical mix | Recommended account count |
|---|---|
| Default (mixed verticals, no special risk) | 6 accounts |
| Healthcare / Wellness / Fintech in mix | **10 accounts** (heavy Factor-First coverage) |
| Verticals overlapping with existing customer base (e.g. Yext, WorkWave, where Rob already has many 1st-degree connections) | **8–10 accounts** (high network density, expect 40–60% drop at Phase 0.7) |

**Why broaden when network density is high (locked v2.1 from batch #12):** Yext + WorkWave returned 7 Apollo-clean candidates but only 3 cleared the LinkedIn-degree gate. 4 of 7 (57%) were 1st-degree connections. Without broader Phase 1 sourcing, you can't backfill to 5 InMail-eligible without re-running Phases 1–4 mid-batch.

**Tools:** Read + Grep on the TAM CSV. The `general-purpose` Agent subagent can run **this Phase 1 account survey only** — supply it MASTER_SENT_LIST.csv to dedup at company-level, and ask it to flag accounts already touched. **Do NOT delegate Phase 2 or 3 work to subagents (see below).**

---

## Phase 2 — Apollo prospecting (MAIN-CONTEXT ONLY)

**🚨 LOCKED RULE v2.1: Apollo prospecting and enrichment runs in the orchestrator only.** Do NOT delegate `apollo_mixed_people_api_search`, `apollo_people_match`, or any Apollo write operation to a subagent. CLAUDE.md rule #6 (locked Apr 24): *"No subagent Apollo trust — Apollo data MUST be verified by direct main-context apollo_people_match calls, never just taken from subagent outputs."*

**Why (locked May 1 from batch #12 dry run):** A general-purpose subagent in batch #12 fabricated Apollo IDs and "DIRTY/CLEAN" classifications, including surfacing a known DNC contact as a "candidate". The orchestrator must run Apollo work itself, full stop.

**Subagents may**:
- ✅ Run Phase 1 account survey (read TAM CSV, flag matches)
- ✅ Analyze files already on disk (per-candidate dossiers, evidence files)
- ✅ Web research where Apollo is not involved

**Subagents must NOT**:
- ❌ Call `apollo_mixed_people_api_search`
- ❌ Call `apollo_people_match` or `apollo_people_bulk_match`
- ❌ Call any Apollo write tool (`apollo_contacts_create`, etc.)
- ❌ Generate or invent Apollo IDs in their output (return an "unknown / needs main-context match" placeholder instead)

**For each candidate account, call `apollo_mixed_people_api_search` with:**
- `q_organization_domains_list: ["<domain>"]`
- `person_titles: ["Director Engineering", "VP Engineering", "Director Software Engineering", "VP Software Engineering"]`
- `person_seniorities: ["director", "vp"]`
- `per_page: 8` (or higher for big accounts)

**Goal:** Surface ~12–15 candidates across all accounts. Apollo people search is FREE — query liberally.

**Persona screen at this stage:**
- Skip industrial / mechanical / hardware engineering titles (Polaris, Iridium, Charles River Labs facilities team)
- Skip clinical / regulatory / pharma QA (IQVIA, MSK Cancer Center)
- Software product engineering only

---

## Phase 3 — Apollo dedup gate (MAIN-CONTEXT ONLY, MANDATORY)

Same lock as Phase 2: **the dedup gate runs in the orchestrator. No subagents.**

**Rule:** Before any candidate proceeds further, call `apollo_people_match` with their Apollo ID. Inspect the response.

**The dedup signal:** `contact.emailer_campaign_ids` field

| State | Meaning | Action |
|---|---|---|
| No `contact_id` field | Not in our Apollo Contacts | ✅ CLEAN |
| `contact.emailer_campaign_ids: []` (empty) | In Contacts but never campaigned (e.g., `csv_import` Robert_TAM_Oct25) | ✅ CLEAN |
| `contact.emailer_campaign_ids: ["69afff8dc8897c0019b78c7e"]` | In Factor-First campaign | ❌ DROP |
| Any other non-empty array | In some campaign | ❌ DROP unless Rob explicit override |

**Why this matters:** Factor-First auto-enrolls Top-10 TAM Director/VP contacts. Those contacts are invisible to MASTER_SENT_LIST grep but show up immediately in Apollo dedup. Skipping this gate produces ~44% drop rate (batch #9 first pass). Applying it upfront produces 0–80% drop rate depending on vertical (batch #12 hit 80% on Yext + Checkr + Rimini).

**Cost:** 1 Apollo credit per match. Budget ~10–20 credits per batch of 5 (some picks will drop, some will be enriched as backups).

**Title accuracy check at this stage too:** If Apollo `title` field shows "Director of Engineering" but `headline` shows e.g. "Sr. Support Cloud Engineer 2 (Lead)", the headline is the true current role. Drop for persona mismatch (Apollo title field is sometimes stale or auto-assigned).

**Pattern that beats Factor-First:** Sr Director > Director > VP for cleanness. International (Amsterdam, Israel, Manila, UK, Canada) > US-based. Specialized titles ("Director Eng - Infrastructure", "Director Cloud", "Sr Director & AMS Site Manager") > generic. Healthcare/wellness TAM (Tandem, Mindbody, HHAeXchange, Veradigm) is heavily Factor-covered — needs different sourcing.

---

## Phase 1.5 — TAM-scope verification (v2.3, strengthened in v3.3)

**Runs after Phase 1 account survey, before Phase 2 Apollo prospecting.**

**Rule (v3.3 strengthened):** For every account the Phase 1 survey surfaced (whether you ran it or a subagent ran it), grep `tam-accounts-mar26.csv` AND `sequences/g2-intent/` main-context. **Any account whose domain is not present in either source is dropped — no exceptions, no override path, no vertical-fit rationale.** This is defense-in-depth for the v3.3 BOUNDED POOL rule from Phase 1; Phase 1.5 catches subagent leakage or accidentally-included accounts that bypassed Phase 0.4.

```bash
# Per-account verification
grep -i "{Company}\|{domain}" tam-accounts-mar26.csv

# Plus G2 authorized check
grep -i "{Company}" sequences/g2-intent/*.md
```

If either grep returns a match → account is in scope, proceed to Phase 2.
If neither returns a match → drop the account silently and surface to Rob in Phase 8.

**Why this gate exists (locked May 1, 2026 — batch #13 part 2):** The Phase 1 subagent surfaced 8 candidate accounts including Carta. After running Phase 2/3/0.6/0.7 on Carta and producing a verified clean candidate (Aditya Mantri), a final TAM-scope check showed **Carta is not on TAM, not on Factor, not on G2**. Subagent had simply asserted "all 8 accounts cleared" without verifying. The subagent's Phase 1 task description didn't even include the TAM CSV path — fabrication risk by omission.

This is the **same failure mode** as v2.1 caught for Apollo work: subagent claims that look reasonable but aren't traceable to actual data reads. The fix is the same: lift the verification main-context.

**Cost:** ~5 seconds per account (one Grep call). If running 8 accounts, ~40 seconds total. Cheap insurance against an out-of-scope send.

**Subagents may still do Phase 1 sourcing** — the survey itself is fine to delegate. But the orchestrator must verify TAM membership of the surfaced accounts before any Apollo credit is spent.

---

## Phase 0.6 — Prior-contact check (NEW in v2.2)

**Runs after Phase 3 dedup, before Phase 0.7 degree gate.**

**Rule:** For every Apollo-clean candidate, run two checks. **Both must be clean** for the candidate to proceed.

### Part A — MASTER_SENT_LIST grep

```
Grep MASTER_SENT_LIST.csv for the candidate's full name (case-insensitive).
Pattern: "{First} {Last}|{first}.{last}|{first} {last}"
```

If any row matches, drop the candidate. They've been touched by some prior outreach motion (T1/T2 email, conference, inbound, prior InMail/DM batch). Re-engaging without context is risky.

### Part B — LinkedIn DM thread check

Use Chrome MCP on the work browser:

1. Navigate to `https://www.linkedin.com/messaging/`
2. `find` the "Search messages" input (placeholder: "Search messages")
3. `form_input` the candidate's full name into that input
4. `key` press `Return`
5. Wait 3 seconds, `get_page_text`
6. **Decision rule:**
   - Page shows "Search inbox / Search by recipient name, message content, or conversation name" with NO conversation rows below (only the persistent Sponsored ad like Ranga Bodla) → **NO THREAD** ✅
   - Page shows ANY non-sponsored conversation row matching the candidate name → **THREAD EXISTS** ❌ DROP
7. Clear the search field before the next candidate

**Why this gate exists (locked May 1, batch #13 dry run):** A 1st-degree LinkedIn connection means Rob and the candidate accepted a connection request at some point. That alone is fine — the network is large. But Rob may also have an active or stale DM thread with that contact, in which case sending another cold-style InMail or net-new DM is wrong: it should be a follow-up that references the prior thread. The Apollo dedup gate cannot see LinkedIn DM history. The DNC list catches explicit opt-outs, but not "we've talked before, just need to pick up where we left off." This gate closes that blind spot.

**Why we use the messaging inbox search and not the candidate profile page:** The Message button on a 1st-degree profile always renders, regardless of whether a thread exists. The inbox search is the only programmatic way to confirm thread state without clicking through.

**Cost:** ~10 seconds per candidate (one form_input + key Return + page-text capture).

**This gate also applies to DM batches.** When routing a 1st-degree spillover to a DM batch, run Phase 0.6 on each candidate first. If a thread already exists, the DM is a follow-up not a cold open — surface to Rob and let him decide whether to reply in-thread or skip.

---

## Phase 0.7 — LinkedIn-degree gate (NEW in v2.1)

**Runs after Phase 0.6 prior-contact check, before Phase 4 deep research.**

**Rule:** For every Apollo-clean candidate, navigate Chrome MCP to `https://www.linkedin.com/in/<slug>/` and capture the connection degree from the public profile page. The degree appears next to the candidate's name as `· 1st`, `· 2nd`, or `· 3rd`.

**Action by degree:**

| Degree | Channel | Action |
|---|---|---|
| 1st | DM (free) | **Drop from InMail batch.** Route to a separate LinkedIn DM batch — do NOT consume an InMail credit on a 1st-degree connection. |
| 2nd | InMail or DM | Keep in InMail batch. (Some 2nd-degrees are open profiles → free InMail.) |
| 3rd / 3rd+ | InMail | Keep in InMail batch. |

**Why this gate exists (locked May 1 from batch #12 dry run):** Yext + WorkWave produced 7 Apollo-clean candidates. Phase 4 deep research caught 4 as 1st-degree connections (Michael Butrym, DJ O'Brien, Adam Dyer, Daniel Lischak). Without a Phase 0.7 gate, those 4 would have wasted InMail credits on contacts who are already in Rob's network and could have been DM'd for free.

**Cost:** ~30 seconds per candidate (one Chrome MCP `get_page_text` call).

**Apollo `linkedin_url` field is the source of truth for the slug.** If Apollo doesn't have the slug, re-call `apollo_people_match` (1 credit) to get it. Do NOT guess slugs — `linkedin.com/in/matthew-hupman/` 404s, the real slug is `matthew-hupman-19b72250`.

**1st-degree spillover handling:** Persist 1st-degree drops to `batches/active/linkedin-inmail-<MMMDD>-batch<N>/dm-spillover.md` so they're not lost. Recommend a follow-up DM batch for them.

---

## Phase 2.5 — LinkedIn pre-screen (NEW in v2.7)

**Runs after Phase 2 Apollo prospecting, BEFORE Phase 3 Apollo dedup.** This is the credit-saver.

**Rule:** Before spending Apollo `apollo_people_match` credits (1 per candidate), do all the FREE screening upfront via Chrome MCP captures. Drop candidates who would fail downstream gates BEFORE paying for dedup.

### Why this gate exists (locked May 1, batch #14)

Batch #14 burned 7 Apollo credits on dedup. Of those:
- 1 credit on Remi Philippe @ SailPoint — Apollo said CLEAN, but Phase 0.6 MASTER grep later caught him as already-sent (Apr 28 Open Profile FREE).
- 4 credits on candidates later caught as 1st-degree at Phase 0.7 (Scott Archer, Christopher Board, Emily Shouppe, Oscar Delgado) — all "CLEAN" Apollo dedup but useless for InMail batch.
- 2 credits on Procore picks that were Factor-First DIRTY (correctly caught — these stay).

Net: **5 of 7 Apollo credits "wasted"** on candidates that downstream gates would reject. v2.7 reorders so the FREE screens (MASTER grep + LinkedIn-degree + deliverability) run BEFORE the paid Apollo dedup.

### Phase 2.5 procedure

For each candidate surfaced by Phase 2 Apollo people search:

**Step 1 — MASTER_SENT_LIST grep (Phase 0.6 part A, FREE)**
```bash
grep -i "{first} {last}|{first}.{last}" MASTER_SENT_LIST.csv
```
- Any match → DROP (prior outreach exists). Don't proceed to LinkedIn capture or Apollo dedup.

**Step 2 — LinkedIn capture (Chrome MCP, FREE)**

For survivors of Step 1:
- LinkedIn URLs: Apollo people search response gives `first_name` + `title` + Apollo `id`. The `linkedin_url` field is NOT in the search response — only in `apollo_people_match`. To get the LinkedIn slug without spending a credit, use Sales Nav search:

```
Navigate Chrome MCP to: https://www.linkedin.com/sales/search/people?keywords={First}%20{Company}
```

Or for known persona-search of a specific account, use the public LinkedIn search with a filter URL.

Capture for each candidate:
- **Connection degree** (`· 1st`, `· 2nd`, `· 3rd`, or no marker = 3rd+)
- **Connection count + follower count**
- **Recent activity** (90-day window)

**Step 3 — Apply degree gate (Phase 0.7, FREE)**
- 1st-degree → drop from InMail batch, route to DM batch
- 2nd / 3rd / 3rd+ → keep

**Step 4 — Apply deliverability pre-check (Phase 0.7.5, FREE)**
- Connections < 20 AND followers < 20 → DROP (INC-030 deliverability risk)
- Connections < 50 OR followers < 50 → flag as ⚠️ deliverability risk (send last in Phase 9)

**Step 5 — Capture activity for Phase 4 hook tier classification**
- Recent activity directly adjacent to pitch → Tier A++ candidate
- Recent activity confirming a topical macro shift → Tier A+
- LinkedIn-quiet → Tier A (tenure-anchored fallback)

### Phase 3 dedup (after Phase 2.5)

Now run `apollo_people_match` ONLY on the candidates who survived Steps 1-4. This is where the credit savings happen.

### Cost comparison

For a 6-account survey with ~10 candidates per account = 60 candidates:

| | v2.6 cost | v2.7 cost |
|---|---|---|
| Apollo people_match calls | 60 (1 per candidate) | ~15 (only Phase 2.5 survivors) |
| Apollo credits spent | 60 | ~15 |
| Time wasted on doomed dedup | ~30 min | ~0 |

A 6-candidate batch with ~70% Phase 2.5 drop rate (typical for SaaS/Tech Director+ Eng) goes from 7 credits → 2-3 credits.

---

## Phase 0.7.5 — Deliverability pre-check (v2.6 — now folded into Phase 2.5)

**Runs after Phase 0.7 degree gate, before Phase 4 deep research.**

**Rule:** Flag candidates whose LinkedIn profile is unusually thin — these often hit INC-030 (LinkedIn-side InMail block) and burn credits on failed sends.

**From the Phase 0.7 capture, extract:**
- Connection count
- Follower count
- Recent activity (any posts/reposts/comments in last 90 days?)

**Risk classification:**

| Signal | Action |
|---|---|
| Connections ≥ 50 AND followers ≥ 50 | ✅ low risk, proceed |
| Connections < 50 OR followers < 50 | ⚠️ thin profile, deliverability risk |
| Connections < 20 AND followers < 20 | ❌ very thin profile, **expect INC-030 failure** |
| No activity in 365 days AND connections < 100 | ⚠️ dormant account, deliverability risk |

**For ⚠️ candidates:** flag in tracker as "deliverability risk" but proceed. Send these LAST in the Phase 9 loop so credits aren't burned before solid sends complete.

**For ❌ candidates:** drop and backfill from Phase 3 queue. The "very thin" pattern (e.g. 1 connection, 2 followers) is a near-guaranteed credit burn — Christophe Brillant batch #13 burned 2 credits on identical failed sends before stopping.

### Why this gate exists (locked May 1, batch #13 send loop INC-030)

Christophe Brillant @ Harmonic passed every gate up to Phase 8 (Apollo clean, 3rd-degree, prior-contact clean, location-verified, 9/10 confidence). At send time:
- Profile capture showed: **1 connection, 2 followers, no posts**
- Send attempt 1: LinkedIn error popup, credit charged, no thread created
- Send attempt 2: identical failure, 2nd credit charged
- Total: 2 credits lost to INC-030 on one candidate

The skill needs to detect "very thin" profiles as a deliverability risk BEFORE the send loop, not after burning 2 credits.

**Future signal candidates to fold in:** Sales Nav "Open to receive InMails" indicator if available, account-status flags from LinkedIn, and pattern-matching on previous INC-030 victims.

---

## Phase 4 — LinkedIn deep research (HARD GATE — Sales Nav lead-page capture required)

**🚨 LOCKED RULE v3.0: Sales Nav lead-page capture is MANDATORY for every candidate, not a fallback. Public LinkedIn profile is the supplement.** The schema below requires 4 new non-empty fields that can ONLY be populated from a Sales Nav lead page (About panel + Experience entries + skills + full activity scan). The shallow public-profile capture used in v2.8/v2.9 satisfies headline/degree but does NOT satisfy v3.0 depth requirements.

**Why this gate exists (locked May 1 from batch #15):** v2.8 evidence file required fields (live_headline, connection_degree, activity_status, evidence_quote_for_hook) were structurally shallow — all four could be populated from a 30-second public profile capture. The orchestrator optimized to satisfy the schema, not to do thorough research. Rob caught it on batch #15: "did we do individual LinkedIn research?" Three of five candidates (Alon, Sebastian, Liana) were LinkedIn-quiet; their hooks fell back to "X years at Y company" tenure framing because the orchestrator hadn't read About sections, Experience-entry prose, or scanned older comments where stronger anchors live. CLAUDE.md "LinkedIn Sales Navigator Research is MANDATORY (Locked Mar 22, 2026)" had been reduced to a public-profile capture in practice.

**v2.8 → v3.0 changes:**
- Sales Nav lead page is REQUIRED FIRST (not "use if public capture fails")
- 4 new required fields force depth: about_section, current_role_description, skills_top5, recent_activity_full
- Phase 4.5 depth audit: each evidence file must be ≥800 chars
- Phase 7.5 D2 penalty: tenure-only hooks cap at 8/10 (forces deeper anchor or drop)

### Step 1 — Sales Nav lead-page capture (REQUIRED FIRST, v3.0)

For each Phase 0.7-cleared candidate, navigate Chrome MCP to the Sales Nav lead page (NOT the public profile):

```
https://www.linkedin.com/sales/search/people?keywords={First}%20{Last}%20{Company}
```

Wait 5 seconds, scroll-down/scroll-up to force render (per v2.9 Friction 7), click the lead's name link to open the lead page panel.

From the Sales Nav lead page, extract via JS section query:

1. **Banner title** (verbatim from Sales Nav banner — usually closer to formal title than public headline)
2. **About panel** (verbatim — Sales Nav About is often denser than public profile About)
3. **Experience entries** — for each role, capture title + dates + the prose description if present (Sales Nav shows fuller prose than public profile)
4. **Skills** (top 5 from skills section)
5. **Recent activity feed** — posts, reposts, comments, last 90 days, ALL items not just first 2-3
6. **Mutual connections + buyer-intent signals**
7. **Tenure precise:** "X years Y months in role | A years B months in company" verbatim

Use the locked sections JS query (validated batches #14, #15):

```javascript
(() => {
  const sections = Array.from(document.querySelectorAll('section'));
  const result = {};
  sections.forEach((s, i) => {
    const heading = s.querySelector('h2')?.innerText || `section_${i}`;
    if (heading && !['0 notifications', 'Explore Premium profiles'].includes(heading)) {
      result[heading] = s.innerText.substring(0, 2500);  // bumped from 1500 in v3.0 for About/Experience depth
    }
  });
  return result;
})()
```

### Step 1b — Public profile capture (SUPPLEMENT, not substitute)

After Sales Nav capture, also navigate to `https://www.linkedin.com/in/<slug>/` and capture for cross-reference. The public profile is useful for:
- Confirming live_headline (self-styled, may differ from Sales Nav banner)
- Catching activity items that show on public but not Sales Nav (rare)
- Verifying degree marker ("· 1st" / "· 2nd" / "· 3rd")

### Step 1c — When Sales Nav fails

If Sales Nav lead-page capture fails (timeout, no result rendered, INC-029 hang) after 2 retries: do NOT fall back to Apollo. Drop the candidate to backfill. Public profile alone is NOT sufficient for v3.0 depth — it satisfies headline + degree but misses About + Experience-entry prose, which is where LinkedIn-quiet candidates' substantive anchors live.

### Step 2 — Persist evidence file (REQUIRED)

Write `batches/active/linkedin-inmail-<MMMDD>-batch<N>/evidence-linkedin/<first-last>.md` with EVERY required field populated:

```markdown
---
slug: <linkedin-slug>
captured_at: <ISO-8601 timestamp>
captured_via: chrome-mcp-public-profile  # or chrome-mcp-sales-nav
---

# <Full Name> — LinkedIn Evidence

**linkedin_url:** https://www.linkedin.com/in/<slug>/
**live_headline:** <verbatim from h1 + headline element on public profile — this is what the recipient self-styles>
**sales_nav_banner_title:** <verbatim from Sales Nav lead card subhead — closer to formal title>
**sales_nav_tenure:** <verbatim "X years Y months in role | A years B months in company">
**live_location:** <verbatim>
**connection_degree:** <1st | 2nd | 3rd | 3rd+>
**follower_count:** <integer or "500+">
**connection_count:** <integer or "500+">
**activity_status:** <ACTIVE | LINKEDIN-QUIET>

## NEW v3.0 required depth fields (all 4 must be non-empty)

**about_section:** <verbatim from Sales Nav About panel; "ABOUT-EMPTY" if profile genuinely has no About — must verify by checking the panel exists and is empty>
**current_role_description:** <verbatim Experience-entry prose for current role; "NONE" only if Sales Nav Experience entry has no description prose, after explicit check>
**skills_top5:** <comma-separated top 5 skills from Sales Nav skills section; "NONE-LISTED" if profile has no skills>
**recent_activity_full:** <ALL activity items from last 90 days, verbatim, each with timestamp; "NO-ACTIVITY-90D" only if zero items present>
**comments_scanned_count:** <integer — number of recent comments scanned for engagement signals>
**hook_substantive_anchor:** <one-liner identifying the substantive material in About OR current_role_description OR an activity item that the hook will reference; "TENURE-ONLY-FALLBACK" only if all three returned no substantive material — but this incurs Phase 7.5 D2 penalty>

## activity_quotes (verbatim — MANDATORY non-empty if activity_status = ACTIVE)

- "<exact quote from post 1>" — <Nmo ago>
- "<exact quote from post 2>" — <Nmo ago>

## activity_quotes (LINKEDIN-QUIET path)

If the profile shows "no recent posts" verbatim, capture that string exactly:
> "<First> has no recent posts" (LinkedIn-quiet, verified <timestamp>)

## evidence_quote_for_hook (REQUIRED non-empty)

The verbatim string the hook will reference, OR "TENURE-ONLY (no LinkedIn anchor — LinkedIn-quiet candidate)".

Example A++: "SailPoint Identity Security Accelerator is now integrated with the Extended plan in AWS Security Hub"
Example A floor: TENURE-ONLY (LinkedIn-quiet — no posts in 90d, anchor on verified tenure)
```

**Required-field check (programmatic gate, v3.0):** Before Phase 6 drafting begins, the orchestrator MUST grep the evidence file for ALL of:
- `live_headline:`
- `connection_degree:`
- `activity_status:`
- `evidence_quote_for_hook:`
- **`about_section:` (NEW v3.0)**
- **`current_role_description:` (NEW v3.0)**
- **`skills_top5:` (NEW v3.0)**
- **`recent_activity_full:` (NEW v3.0)**
- **`hook_substantive_anchor:` (NEW v3.0)**

Every one of those fields MUST have a non-empty value after the colon. "ABOUT-EMPTY" / "NONE" / "NO-ACTIVITY-90D" / "NONE-LISTED" / "TENURE-ONLY-FALLBACK" placeholder strings are only acceptable if the orchestrator explicitly verified the source data is genuinely empty (not just skipped). If any field is empty (no placeholder, just blank), the candidate is BLOCKED from drafting.

## Phase 4.5 — Depth audit (NEW v3.0, programmatic)

**Runs after Phase 5 evidence-file persistence, before Phase 6 drafting.**

Each evidence file must satisfy:

```bash
# Each evidence file must be ≥800 chars (forces written depth, not just metadata)
for f in batches/active/<batch>/evidence-linkedin/*.md; do
  size=$(wc -c < "$f")
  if [ "$size" -lt 800 ]; then echo "BLOCK: $f below depth floor ($size chars)"; fi
done
```

For LINKEDIN-QUIET candidates: the `about_section:` field MUST contain ≥100 chars of verbatim About prose (or genuinely-verified "ABOUT-EMPTY"). If About is empty AND no current_role_description AND no recent_activity_full, the candidate is BLOCKED — drop and backfill rather than ship a tenure-only LinkedIn-quiet hook.

For ACTIVE candidates: at least 3 distinct activity items must be captured in `recent_activity_full:`, not just the first one that auto-loaded.

**Why this gate exists (locked May 1, batch #15):** v2.8 evidence files passed the schema check at ≤300 chars (just headline + degree + activity placeholder). The 800-char floor forces the orchestrator to write down what it actually read in About + Experience + activity — surfacing skipped depth.

**Title reconciliation rule (NEW v2.9):** Three title sources can disagree:
- Apollo `title` (formal title from Apollo's data feed)
- LinkedIn `live_headline` (self-styled, often verbose, may include personal taglines)
- Sales Nav `sales_nav_banner_title` (Sales Nav's coded title, usually closest to formal)

When they conflict (batch #14 Barak: Apollo "Director of Engineering" vs LinkedIn "Software Engineering Senior Manager" vs Sales Nav "Director of Engineering"):
1. **Sales Nav banner title is the priority** — it's pulled from LinkedIn's structured Experience entry, not the recipient's free-form headline.
2. If Apollo and Sales Nav agree but public headline differs: trust Apollo + Sales Nav. The recipient may have chosen a more general public headline.
3. If all three disagree: drop the title from the hook entirely and anchor on tenure + role-frame (e.g. "two-plus years in" rather than "as Director of...").
4. **Never use a title in the hook that isn't backed by Sales Nav OR Apollo.** Public-headline-only titles are self-styled and may be misleading.

```bash
# Required-field check (run before Phase 6)
for f in batches/active/<batch>/evidence-linkedin/*.md; do
  for field in live_headline connection_degree activity_status evidence_quote_for_hook; do
    val=$(grep "^\\*\\*$field:\\*\\*" "$f" | sed 's/^[^:]*:[* ]*//')
    if [ -z "$val" ]; then echo "BLOCK: $f missing $field"; fi
  done
done
```

### Step 3 — If Chrome MCP capture fails

**Apollo data is NOT a fallback.** If `get_page_text` times out, hangs, or returns `[BLOCKED: Cookie/query string data]`, do this in order:

1. **Retry once.** Wait 5 seconds, re-fetch with the JS sections query above.
2. **If retry fails: try Sales Nav lead page.** Navigate `linkedin.com/sales/search/people?keywords={First}+{Company}`, click into the lead, capture sections.
3. **If Sales Nav lead page also fails: drop the candidate to backfill queue.** Do NOT proceed with Apollo-only data. Backfill from Phase 3 reserves.

The orchestrator does NOT compose a draft for a candidate without a populated evidence file. Period.

**INC-029 recovery (Chrome MCP hung tab):** New tab → navigate to `linkedin.com/sales/inbox` → close stuck tab → resume capture on a fresh tab. See `memory/incidents.md` INC-029.

---

## Phase 5 — Gate 6.5 per-candidate files

For each verified clean + degree-eligible candidate, write `batches/active/linkedin-inmail-<MMMDD>-batch<N>/candidates/<first-last>.md` with:

- Name + company + title + tenure
- Apollo ID
- LinkedIn URL
- Email (verified status)
- Apollo-clean note (e.g., "✅ NO contact_id, NO emailer_campaign_ids")
- **Connection degree** (NEW v2.1: explicit "3rd ✅ InMail-eligible" line)
- Headline (verbatim)
- Career narrative (Apollo employment_history)
- **Evidence file pointer (NEW v2.8, REQUIRED):** `evidence_file: evidence-linkedin/<first-last>.md` — link must resolve to an existing file with all required fields populated. Per-candidate file BLOCKS Phase 6 if this pointer is missing or broken.
- **Live headline (verbatim from evidence file):** copy-paste of the `live_headline:` field
- **Activity status (from evidence file):** ACTIVE or LINKEDIN-QUIET (verbatim)
- **Evidence quote for hook (verbatim from evidence file):** copy-paste of `evidence_quote_for_hook:` field
- Recent LinkedIn activity findings (from Phase 4 evidence file)
- Mutual connections
- Vertical + macro shift
- Hook anchor (one line — must contain a substring of the evidence_quote_for_hook OR be tenure-only if LINKEDIN-QUIET)
- Tier (A / A+ / A++)
- Confidence %

**Why:** This file is the recovery snapshot — survives context-compaction. If the conversation gets compacted mid-batch, the per-candidate files are the source of truth for resuming.

**Phase 5 → Phase 6 transition gate (NEW v2.8):**
```bash
# Verify each per-candidate file has a valid evidence_file pointer
for cand in batches/active/<batch>/candidates/*.md; do
  evidence=$(grep "^evidence_file:" "$cand" | sed 's/^evidence_file: //')
  if [ ! -f "batches/active/<batch>/$evidence" ]; then
    echo "BLOCK: $cand evidence_file missing or broken: $evidence"
  fi
done
```

If any candidate's evidence pointer is broken, that candidate is BLOCKED from Phase 6 drafting until the evidence file is captured.

---

## Phase 6 — Draft v3 (Standard SOP voice)

Format per draft:

```
Hi {First},

I'm at Testsigma, AI-powered test automation. Hopefully its not too much to ask how the {macro shift / topic} at {Company} has been landing on the engineering side, {tenure or role frame}?

Reason I'm asking, when {company-specific scaling moment}, the testing surface tends to multiply fast. {3–5 specific paths} all hitting cross-stack scenarios at the same time.

CRED is one example. As their FinTech app scaled, they got to 90% automated regression coverage with 5x faster execution once AI took over the test authoring and self-healing work their team had been carrying manually.

Testsigma's Agent does that across web, mobile, and API. Plain-English test authoring, AI self-healing when locators break, and coverage gaps surfaced automatically as new features ship.

Curious if any of that sounds like what your team is running into at {Company}?

Best,
Rob
```

**Voice rules:**
- "Hopefully its not too much to ask…" — humble macro-shift opener (verbatim, intentionally lowercase "its")
- "Reason I'm asking, when…" — connector
- "CRED is one example. As their FinTech app scaled…" — verbatim proof point (90% regression / 5x faster)
- "Testsigma's Agent does that across web, mobile, and API…" — capability paragraph
- "Curious if any of that sounds like what your team is running into at {Company}?" — curious close
- Sign-off: `Best,\nRob` — verbatim, no em dash, no "— Rob"
- Total body length: ~1000–1100 chars
- Subject: 4–10 words, no em dashes, anchors to the macro hook

**Save to:** `batches/active/linkedin-inmail-<MMMDD>-batch<N>/INMAIL-T1-DRAFTS-v3.md`

---

## Phase 7 — v3 → v4 hook upgrade pass

**For each draft, ask:** Does the deep research from Phase 4 unlock a stronger hook than the v3 macro-shift framing?

**Hook tier system:**

| Tier | What it anchors on | Example |
|---|---|---|
| A++ | Recent activity directly adjacent to our pitch | Santanu's #aitesting podcast repost — same topical area as Testsigma |
| A+ | Recent activity confirming a topical macro shift | Mark's MCP Server repost (3wk) — confirms FactSet AI macro |
| A | Verified Apollo career-tenure (LinkedIn-quiet) | Peter's 12y Infor tenure — solid factual anchor |
| B | Generic / inferred | NEVER ship — drop or rewrite |

**Goal:** 3+ of 5 drafts at A+ or A++ tier. Avg confidence 95%+.

**If the entire batch is LinkedIn-quiet (Tier A only across the board), warn Rob during Phase 8** — that's a signal the candidates aren't producing strong hooks and the batch may want broader sourcing or a different vertical mix.

**Save upgraded drafts to:** `INMAIL-T1-DRAFTS-v4.md` (keep v3 as audit trail).

---

## Phase 7.5 — Per-prospect confidence gate (NEW in v2.4)

**Runs after Phase 7 hook upgrade, before Phase 8 presentation.**

**Rule:** Every draft must score **9/10 minimum** across three dimensions before it advances to APPROVE SEND. If a draft scores below 9/10, take one of three actions: deeper research pass, hook rework, or drop the candidate.

### Three-dimensional rubric

**Dimension 1 — Formula compliance (binary, must pass all 10):**
1. Lowercase "its" in opener (intentional)
2. Verbatim opener: "Hopefully its not too much to ask how the {macro shift / topic} at {Company} has been landing on the engineering side, {tenure or role frame}?"
3. Verbatim connector: "Reason I'm asking, when…"
4. Verbatim proof point — CRED 90%/5x OR Medibuddy 50%/2,500 OR Nagra DTV 2,500/4x. Pick by vertical match.
5. Verbatim capability: "Testsigma's Agent does that across web, mobile, and API. Plain-English test authoring, AI self-healing when locators break, and coverage gaps surfaced automatically as new features ship."
6. Verbatim close: "Curious if any of that sounds like what your team is running into at {Company}?"
7. Sign-off: `Best,\nRob` (no em dash, no "— Rob")
8. Subject 4-10 words, no em dashes
9. No em dashes anywhere in body
10. Body char count ~1000-1100 (InMail) or 640-840 (DM)

**Score: pass = 1, fail = 0. All 10 must pass.**

**Dimension 2 — Deep research traceability (claim-by-claim):**

For every concrete claim in the body (titles, tenure numbers, technologies, geography, recent activity, customer integrations, hiring signals), identify the source AND classify by type:

**Source classes:**
- ✅ **LinkedIn-verified** = traces to a verbatim quote in the candidate's `evidence-linkedin/<slug>.md` file (live_headline, activity_quotes, About, Experience entry). Cite the field name.
- ✅ **Apollo-confirmed** = traces to Apollo `employment_history`, `organization.keywords`, or location. Apollo is acceptable for **tenure, role title, and location facts** — but NOT for activity claims.
- ⚠️ **Inferred** = no direct source; reasoned from circumstantial evidence.
- ❌ **Fabricated** = no traceable source.

**Activity-claim hard rule (NEW v2.8):** Any phrase in the body that asserts engagement with the recipient's LinkedIn output ("saw your post about X", "congrats on the launch", "noticed your repost", etc.) MUST trace to a verbatim string in the evidence file's `activity_quotes` section. **No quote in evidence file = AUTO-FAIL D2 = -3 penalty = DROP.** This closes the v2.7 loophole where Apollo "confirms" the company news but the draft pretended the recipient personally posted/reposted it.

**Tenure-only path penalized (NEW v3.0, clarified v3.2):** Tenure-only hooks ("twelve years at Bluevine", "fifteen months in") cap at **D2 = 8/10** — incurring the per-prospect confidence floor failure (overall 9/10 minimum) UNLESS the orchestrator has explicitly verified all three depth-source paths are genuinely empty. This forces the orchestrator to find a substantive anchor in `about_section:`, `current_role_description:`, or a verbatim activity quote rather than fall back to "X years at Y company" generic.

**v3.2 clarification — when tenure-only at 8/10 is acceptable as a floor (rare, requires verification):**
- `about_section:` field documented as `ABOUT-EMPTY` AFTER explicit verification (Sales Nav lead page checked, About panel either absent or empty)
- `current_role_description:` field documented as `NONE` AFTER explicit verification (Experience entry has title + dates but no prose description)
- `recent_activity_full:` field documented as `NO-ACTIVITY-90D` AFTER explicit verification (Sales Nav activity panel says verbatim "X hasn't had any recent activity on LinkedIn in the last 90 days" OR public profile activity is genuinely empty/personal-only)
- The `comments_scanned_count:` field shows the orchestrator actually scanned (e.g., "1" or "3") rather than skipping

If all three depth sources are genuinely empty AND the orchestrator has documented the empty state (not just left placeholder), tenure-only at 9/10 D2 + 9/10 D3 = 9/10 overall is acceptable. The floor is for verifiable LinkedIn-quiet candidates with rich career-tenure (e.g., Alon Dissentshik @ Bluevine in batch #15: 11.5y career-grown internally through five roles including a distinctive 5-yr "Director of Internal group" chapter — this is verifiable career-arc material, not generic tenure).

If after deeper About/Experience/activity research no substantive anchor surfaces AND the verifiable tenure data is generic ("X years at Y company"), the candidate is dropped at Phase 7.5 enhancement loop Path C — not shipped.

For LINKEDIN-QUIET candidates: the hook MUST reference at least one verbatim element from `about_section:` OR `current_role_description:` OR `skills_top5:` (e.g., "your work building ML infrastructure at Bluevine" if her About says "Building ML Infrastructure"). The hook MUST NOT contain "saw your X" / "congrats on Y" claim about a LinkedIn post since there are no posts to reference.

For ACTIVE candidates: any "saw your X" claim MUST trace verbatim to `recent_activity_full:`. No quote in evidence file = AUTO-FAIL D2 = DROP (existing v2.8 rule, retained).

**Score:**
- 10/10 = every concrete claim is LinkedIn-verified or (for tenure/role/location) Apollo-confirmed; zero Inferred
- 9/10 = 1 claim Inferred or Apollo-only-where-LinkedIn-was-needed, all others Verified
- ≤8/10 = 2+ claims Inferred OR any claim Fabricated OR any activity claim without evidence_file quote → REWORK or DROP

**Dimension 3 — Personalization specificity:**
- 10/10 = recipient-specific anchors throughout (verifiable activity, exact tenure date, specific recent integration, specific shipped feature)
- 9/10 = at least one recipient-specific anchor + verifiable tenure/role frame; non-anchor sections may be generic-company
- 8/10 = generic-company hook with verified tenure anchor only (Tier A LinkedIn-quiet floor — acceptable ONLY when LinkedIn captured-quiet AND no other recipient-specific data exists)
- ≤7/10 = generic claims OR inference where verification was possible → REWORK or DROP

### Scoring formula

**Overall confidence = min(D1 binary, D2, D3).** A draft fails if any dimension scores <9.

### Auto-enhancement loop (v2.5 — runs automatically when score <9/10)

**🚨 The orchestrator does NOT present sub-9 drafts to Rob.** When a draft scores <9/10, run Path A → B → C in order, automatically. Continue to the next draft only when the current draft hits ≥9/10 or the candidate is dropped.

```
for each draft in batch:
  score = audit(draft)             # D1 binary, D2 traceability, D3 specificity
  if score >= 9: continue          # ✅ pass, move to next draft

  # Path A — deeper research
  evidence = sales_nav_lead_capture(candidate)
  if evidence.has_new_anchor:
    draft = rewrite_with_anchor(draft, evidence)
    score = audit(draft)
    if score >= 9: continue

  # Path B — hook rework to verified-only
  draft = rewrite_to_tier_a_floor(draft, candidate.verified_facts)
  score = audit(draft)
  if score >= 9: continue

  # Path C — drop + backfill
  drop(candidate, reason=audit.failure_dimensions)
  backfill = next_phase3_clean_candidate(account_diversity_weighted=true)
  if backfill is None:
    # roster shrinks; do not weaken with sub-9 picks
    halt_loop()
    break
  candidate = backfill
  run_gates(candidate)             # Phase 0.6 + 0.7 + 4 on backfill
  draft = compose(candidate)
  # re-enter loop on backfill draft
```

### Path A — deeper research pass (auto)

Sales Nav lead pages often have fuller Experience entries (with exact start dates) and About-section copy that LinkedIn public pages and Apollo don't surface.

Workflow:
1. If candidate has a known Sales Nav lead URN, navigate directly. Otherwise, search via `linkedin.com/sales/search/people?keywords={First}+{Last}+{Company}`.
2. `find` and click the matching result (apply INC-027 strict subhead match — verify Apollo-title + company match before clicking).
3. Capture the Experience tab via `get_page_text` — extract start dates per role and any project / team / tech mentions.
4. Capture the About section if present.
5. Identify any new recipient-specific anchor (a project, an integration, a verified tenure milestone Apollo missed).
6. Re-write the hook with the new anchor.
7. Re-score.

### Path B — hook rework to verified-only (auto)

If Path A yields no new evidence, strip out every unverifiable claim from the draft. Anchor the hook to **only** verified facts:
- Tenure (Apollo `start_date` for current role) → tenure-anchored opener
- Role title (Apollo verified) → role-frame opener
- Location (Apollo verified) → geographic-frame opener
- Tech stack (Apollo organization keywords) → company-vertical proof point match

The Tier A floor is "verified-tenure-only opener" — that frame at minimum hits 9/10 because tenure is recipient-specific AND verified.

### Path C — drop + backfill (auto)

If after Paths A and B the draft still scores <9/10, drop the candidate. Log the failure dimension (D2 inference, D3 generic, etc.) for the batch tracker. Then backfill from the **next-strongest Phase 3-clean candidate** in the queue.

**Backfill selection rules:**
- Prefer 3rd-degree over 2nd-degree (free InMail credit risk-adjusted)
- Prefer different account than the dropped candidate (account diversity)
- Run all gates (Phase 0.6 prior-contact, Phase 0.7 degree, Phase 4 deep research) on the backfill before drafting
- Re-enter the Phase 7.5 audit loop on the backfill draft

**If the queue is empty:** halt the loop with N strong InMails. Never fill the gap with sub-9 picks. Rob would rather send 3 strong than 5 with weak links.

### What Rob sees at Phase 8

By the time Phase 8 presents, every draft in the roster is ≥9/10. The Phase 8 view includes:
- Per-prospect score (D1 / D2 / D3 / overall)
- Hook tier (A / A+ / A++)
- Audit log entries for any draft that went through the enhancement loop (e.g., "Christophe — Path A surfaced exact 2024-09 start date, hook re-anchored, score now 9.5/10")
- Drop log if any candidates were dropped + backfill log if any were replaced

Rob never has to choose between sending a sub-9 draft or remediating it — the skill has already remediated.

### Confidence floor by hook tier

| Hook tier | Floor |
|---|---|
| A (LinkedIn-quiet, tenure-anchored) | 9/10 (was 8.5/10 in v2.3 — tightened in v2.4) |
| A+ (recent activity confirms macro) | 9.5/10 |
| A++ (recent activity directly adjacent to pitch) | 9.5/10 |

### Why this gate exists (locked May 1, batch #13 audit)

The batch #13 first-pass drafts hit 5/5 on formula compliance and avg 93.2% confidence — but the per-draft audit revealed wide variance:
- Sukhmeet Toor: 9.5/10 — every claim traceable to his recent posts
- Anoop Gupta: 9/10 — verified tenure, verified tech stack
- Titan Yim: 9/10 — verified recent role move, verified video tech stack
- Jeff Biggs: 8/10 — generic-TQL framing, LinkedIn-quiet limit
- Christophe Brillant: 6.5/10 — "Rennes engineering chapter" was inference, not verified

Without Phase 7.5, the Christophe inference would have been sent. Rob caught it on review. The gate now forces this audit programmatically.

---

## Phase 8 — QA Gate + present for APPROVE SEND

**🚨 LOCKED RULE v2.8: Pre-presentation gate — every roster row MUST link to its evidence file and quote the verbatim hook anchor.** If any row's `Evidence` link is missing or the `Quote` field is empty, halt before presenting and remediate (re-capture or drop).

Show Rob a table with:

| # | Recipient | Account | Vertical | Degree | Tier | Conf | Evidence | Quote | Hook anchor |

- `Evidence` = file path link to `evidence-linkedin/<slug>.md`
- `Quote` = verbatim string from `evidence_quote_for_hook:` field of the evidence file (or "TENURE-ONLY" if LinkedIn-quiet)
- `Hook anchor` = one-liner showing how the draft uses the quote

(Note: `Degree` column added in v2.1. `Evidence` and `Quote` columns added in v2.8.)

**Why these columns matter at Phase 8:** Rob needs to see at-a-glance that every draft traces to a real LinkedIn capture and that the verbatim phrase used in the hook actually exists on the recipient's profile. v2.7 didn't surface the evidence quote, so a draft built on Apollo-only could pass Phase 8 review with a hook that sounded plausible but wasn't anchored. v2.8 makes the trace visible.

Plus pre-flight checklist:
- [x] Gate -1 TAM scope ✓
- [x] Gate 0 DNC cross-check ✓ (NEW v2.1)
- [x] Gate 0 Apollo dedup ✓ (main-context)
- [x] Gate 0.7 LinkedIn-degree ≥ 2nd ✓ (NEW v2.1)
- [x] Gate 6.5 per-candidate files ✓
- [x] Gate 7 LinkedIn deep research ✓
- [x] Voice audit ✓
- [ ] **Rob APPROVE SEND**

If 1st-degree spillover contacts exist, surface them as a separate "DM batch recommendation" in Phase 8 — not part of the InMail APPROVE SEND, but a distinct ask: "should I prep these as DM drafts?"

WAIT for explicit "approve send" / "send" / similar before proceeding to Phase 9. Per CLAUDE.md hard rule: NEVER send any outreach without Rob's explicit APPROVE SEND.

---

## Phase 9.0 — Pre-send thread-state re-verification (NEW v3.1)

**🚨 LOCKED RULE v3.1: Before the Phase 9 send loop begins, re-run Phase 0.6b LinkedIn inbox thread search on all roster names. Any non-empty result for a candidate BLOCKS that candidate's send — don't burn an InMail credit on a contact you already have a thread with.**

**Why this gate exists (locked May 1 from batch #15):** Phase 0.6 prior-contact checks run at sourcing-time. Hours or days can pass between sourcing and APPROVE SEND, during which:
- A separate session may have sent the candidate an InMail/DM
- The candidate may have replied to a related cold DM and surfaced a thread
- A forwarded message may have started a thread
- Apollo may have synced a previously-hidden contact record

The MASTER_SENT_LIST is updated post-send only — it cannot catch these in-flight states. The LinkedIn inbox is the only authoritative source.

### Procedure

```javascript
// Run inbox search on each roster candidate's full name
(async () => {
  const inp = document.querySelector('input[placeholder="Search messages"]');
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  const names = ['First Last 1', 'First Last 2', /* ... */];
  const results = {};
  for (const name of names) {
    setter.call(inp, '');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 600));
    setter.call(inp, name);
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise(r => setTimeout(r, 2200));
    const list = document.querySelector('ul.msg-conversations-container__conversations-list');
    const items = list ? Array.from(list.querySelectorAll('li')).map(li => li.innerText.substring(0, 80).trim()).filter(t => t.length > 0) : ['NO_LIST'];
    results[name] = { count: items.length, isClean: items.length === 2 && items.some(t => t.startsWith('Search inbox')) };
  }
  return results;
})()
```

**Decision rule per candidate:**
- `isClean: true` (count = 2, "Search inbox" placeholder visible, only Sponsored ad in list) → CLEAR FOR SEND ✅
- `isClean: false` (any matching conversation row) → BLOCK send for that candidate. Surface to Rob: "Phase 9.0 caught existing thread with {Name}, dropped from this batch loop."

**Cost:** ~15 seconds for the full roster (2-second wait per name, 5 names = 11s + a bit of overhead). Trivial.

**Same applies to MASTER_SENT_LIST:** before send loop, also re-grep MASTER for each candidate's full name. Any new row added since sourcing = BLOCK that candidate's send.

```bash
# Re-run MASTER grep at send time
for name in "Santosh Hegde" "Sebastian Thierer" /* ... */; do
  if grep -i "$name" MASTER_SENT_LIST.csv; then
    echo "BLOCK: $name appeared in MASTER since sourcing — drop from send loop"
  fi
done
```

If both gates pass for all candidates, proceed to the send loop below.

---

## Phase 9 — Send loop

### Browser setup

- ALWAYS use work Chrome (Testsigma profile). If `list_connected_browsers` shows multiple, ask Rob via `AskUserQuestion`.
- If `tabs_context_mcp` returns "No tab group exists for this session", call `tabs_context_mcp({createIfEmpty: true})` to spin up a fresh group.
- Take an initial screenshot of any Sales Nav page to confirm credit balance — record as **starting credit balance**.

### Per-send sequence (locked v2.9 — validated batch #14)

The "compose from inbox" path used in earlier versions hit INC-027 disambiguation pitfalls (typing names into the recipient combobox). The cleaner path is **Sales Nav search → click chat-bubble icon directly on the lead row**. This worked 5/5 in batch #14.

For each candidate in the roster:

**1. Navigate to Sales Nav search** (search by name + company):

```
https://www.linkedin.com/sales/search/people?keywords={First}%20{Last}%20{Company}
```

Wait 5 seconds for results to render.

**2. Force search-result render via scroll** — Sales Nav lazy-renders the result card; without this, `<a>` links and inline action icons aren't in the DOM:

```javascript
// scroll down 1 tick, scroll up 1 tick
```

Use Chrome MCP `computer.scroll` direction down (1 tick) + up (1 tick), wait 2 seconds.

**3. Verify single-result lead card** — take a screenshot, confirm:
- Lead name + degree badge visible (`· 2nd` or `· 3rd`)
- Title in subhead matches Apollo title (this IS the Sales Nav banner title, capture for evidence)
- Tenure in subhead ("X years Y months in role") — capture for evidence file
- "1 results" indicator above the card

If "Did you mean: ..." correction is shown, ignore it (LinkedIn over-suggests). If 0 results: try `keywords={First}+{Last}` only, then `keywords={Last}+{Company}`.

**4. Click the chat-bubble (Message) icon on the lead row** — coordinate-click is faster + more reliable than `find` because Sales Nav doesn't always expose a clean aria-label for the row icon:

- Action icons (More, Message, Save) sit at right side of the row, x = 1163
- **Y-coordinate varies by row content:**
  - Y=207 when the row has a "buyer intent" panel below the name (account-level intent expanded)
  - Y=184 when the row is compact (no buyer-intent panel)
- **Try y=207 first.** If composer doesn't open within 4 seconds (verify via JS check), try y=184. Don't try a 3rd time — fall back to clicking the lead name link.

```javascript
// composer-open verification
(() => {
  const subjectInput = document.querySelector('input[placeholder*="Subject"]');
  const bodyArea = document.querySelector('textarea[aria-label="Type your message here or draft with AI"]');
  return { composerOpen: !!subjectInput && !!bodyArea };
})()
```

**5. JS-inject subject + body via React-compatible setter:**

```javascript
(() => {
  const subjectText = "<subject>";
  const bodyText = `<body>`;
  // Dismiss any tooltip / "Personalize your message" prompt
  const close = document.querySelector('button[aria-label*="Dismiss" i]');
  if (close) close.click();
  // LOCKED v2.9 selectors — validated batch #14
  const subjectInput = document.querySelector('input[placeholder*="Subject"]');
  const bodyArea = document.querySelector('textarea[aria-label="Type your message here or draft with AI"]');
  if (!subjectInput || !bodyArea) return { error: 'fields not found', subjectFound: !!subjectInput, bodyFound: !!bodyArea };
  const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
  inputSetter.call(subjectInput, subjectText);
  subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
  const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
  textareaSetter.call(bodyArea, bodyText);
  bodyArea.dispatchEvent(new Event('input', { bubbles: true }));
  return { subject: subjectInput.value, bodyLen: bodyArea.value.length, bodyEnd: bodyArea.value.substring(bodyArea.value.length - 30) };
})()
```

**Selector notes (locked v2.9):** the body field is `<textarea aria-label="Type your message here or draft with AI">` — verbatim. The earlier broader selector `textarea[aria-label*="message"]` failed in batch #14 because the new Sales Nav composer doesn't include "message" in its aria-label anymore. Use the full string match.

**6. INC-022 readback (mandatory):** verify `bodyEnd` ends with `"?\n\nBest,\nRob"` — char-for-char match against the draft. If mismatch: STOP, clear, re-inject, re-verify. NEVER click Send if readback fails.
9. `find` "Send" button → click.
10. Wait 4 seconds, screenshot.
11. **Verify success state — three signals required:**
    - URL transitioned from `/sales/inbox/compose` to `/sales/inbox/2-{thread-id}/`
    - Thread shows "Awaiting reply from {Name}" timestamp
    - Inbox left pane shows the new conversation at top
12. **Detect credit charge type:**
    - Credit count dropped by 1 → **Paid InMail** ✅
    - Credit count stayed the same → **Open Profile FREE** ✅ (some 2nd/3rd degree contacts are open-profile and free)
13. **INC-024 MASTER append (mandatory):**
    ```
    {Name},LI-InMail-T1-{MMMDD}-Batch{N},{YYYY-MM-DD},LinkedIn InMail{paid:''/free:' (Open Profile FREE)'},{credit_count},batches/active/linkedin-inmail-<MMMDD>-batch<N>/INMAIL-T1-DRAFTS-v4.md,{lowercase name}
    ```

---

### Phase 9 friction handling (NEW v2.6 — locked from batch #13 send loop)

The send loop hits a few predictable friction points. Each has an explicit recovery procedure.

#### Friction 1 — Compose dialog won't open / pencil click no-op

**Symptom:** Click on "Compose new message" pencil icon results in no compose dialog. URL doesn't transition to `/sales/inbox/compose`.

**Cause:** Two compose buttons exist (`ref_133` "New Message" in nav menu, `ref_149` pencil in banner). The nav-menu one (`ref_133`) sometimes opens a profile pane instead of the compose dialog.

**Recovery:** Use the **banner pencil icon** (search pattern: "pencil icon at top of message list"). If `find` returns 2 matches, prefer the one labeled "pencil icon" or the one in the banner (not nav menu).

#### Friction 2 — "Leave site?" dialog blocks navigation

**Symptom:** When trying to navigate away from `/sales/inbox/compose`, browser returns: *"Navigation was blocked by a 'Leave site?' dialog — the page has unsaved changes."*

**Cause:** The previous compose still has subject/body content. LinkedIn detects unsaved state.

**Recovery (in order):**
1. Clear the compose subject + body via JS:
   ```javascript
   (() => {
     const subjectInput = document.querySelector('input[aria-label="Subject (required)"]');
     const bodyArea = document.querySelector('textarea[aria-label*="message"]');
     const inputSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set;
     inputSetter.call(subjectInput, "");
     subjectInput.dispatchEvent(new Event('input', { bubbles: true }));
     const textareaSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
     textareaSetter.call(bodyArea, "");
     bodyArea.dispatchEvent(new Event('input', { bubbles: true }));
     return { subject: subjectInput.value, bodyLen: bodyArea.value.length };
   })()
   ```
2. Re-attempt navigation.
3. If still blocked: click the X / dismiss button on the compose dialog programmatically.

#### Friction 3 — Send error popup (INC-030, locked May 1, batch #13)

**Symptom:** After clicking Send:
- Error toast appears bottom-left: *"There was an issue sending your InMail, please try again."*
- Credit count drops by 1 (charged)
- URL remains on `/sales/inbox/compose` (no thread transition)
- Compose pane retains content
- Inbox search for the recipient returns "We couldn't find any messages with '{Name}'" — confirming no thread was created

**Cause:** LinkedIn-side account-state issue. Most often when the recipient's profile is very thin (low connection count, low follower count, no activity). Sometimes also account-restricted or InMail-disabled at the recipient's settings.

**Recovery (stop-loss rule, NEW v2.6 hard rule):**
1. **Verify the failure** — search the recipient's name in the inbox via the search input. If "We couldn't find any messages with…" → confirmed no delivery.
2. **One retry maximum.** Clear the compose, re-open compose new, re-search recipient, re-inject draft, re-attempt send.
3. **If retry also fails (credit charged again, no thread):**
   - **STOP.** Do NOT attempt a 3rd time. Each attempt burns a credit.
   - Add the candidate to CLAUDE.md DNC list with reason: "INC-030 — LinkedIn-side InMail block, N credits lost"
   - Skip and continue to next candidate in the loop.
   - Log to batch tracker: "FAILED — INC-030, dropped after 1 retry"

**Critical:** Phase 0.7.5 deliverability pre-check is the upstream defense for this. If a candidate has connections < 20 AND followers < 20, they should have been dropped at Phase 0.7.5 before any credit was at risk.

#### Friction 4 — Sales Nav compose page hang (INC-029, batch #11)

**Symptom:** Chrome MCP tools (`computer:left_click`, `find`, `get_page_text`, `screenshot`) time out after the first action on Sales Nav compose page. `tabs_context_mcp` still works.

**Cause:** Sales Nav compose page never reaches `document_idle` state due to async side-panel data loading.

**Recovery:**
1. `tabs_create_mcp` to create a new tab in the same group
2. Navigate the new tab to `https://www.linkedin.com/sales/inbox/`
3. Wait 4 seconds, screenshot to verify state
4. `tabs_close_mcp` on the stuck old tab
5. Resume work on the fresh tab

**If recovery fails:** stop and ask Rob to manually intervene per CLAUDE.md hard rule (browser-level issues are not for programmatic workaround).

#### Friction 5 — Multi-match recipient search (INC-027 strict subhead check)

**Symptom:** Typing `{First} {Last} {Company}` returns 2+ search result options.

**Cause:** Common names ("Peter Storey", "Mark Smith"), French/English title variants of the same person ("Director chez Harmonic" vs "at Harmonic"), namesake at different company.

**Recovery:**
1. Read each option's subhead text from the `find` result.
2. Compare to the candidate's verified Apollo `title` + `organization_name`.
3. Click ONLY the option whose subhead matches Apollo verbatim. **Never default to "first result".**
4. Confirm the recipient pill + right-pane profile after click match the Apollo data.

If no option matches Apollo verbatim, pause and ask Rob.

#### Friction 6 — CRM match dialog after send (NEW v2.9, batch #14)

**Symptom:** After clicking Send (and the InMail is successfully delivered + credit charged), Sales Nav overlays a dialog: *"Is this the right CRM match? To log your Message in CRM, please confirm we've matched {recipient}'s LinkedIn profile to the right CRM record."* with **"No, edit"** and **"Yes"** buttons.

**Cause:** Sales Nav prompts to log the InMail as an Activity in the connected Salesforce instance. The dialog appears for contacts not yet in CRM (or for a fresh CRM-Sales-Nav matching session).

**Decision rule:** **Always dismiss, never confirm.** Per CLAUDE.md hard rule "NEVER take any action visible to Rob's coworkers", we don't auto-log to Salesforce — that creates an Activity record his sales ops team and AE see. The InMail send itself has already completed by the time this dialog appears (verified via credit decrement); the dialog is purely about CRM logging.

**Recovery:**
1. `find` "Dismiss button for CRM match dialog" or use the X close icon on the dialog.
2. Click Dismiss (NOT "No, edit" — that opens an edit-the-match flow we don't want either).
3. Continue to next candidate.

#### Friction 7 — Sales Nav search result not rendering links (NEW v2.9, batch #14)

**Symptom:** After navigating to `/sales/search/people?keywords=...`, the page shows "1 results" but a JS query for `a[href*="/sales/lead/"]` returns 0. The result `<article>` element is rendered but the inner content (link, action icons) isn't in the DOM yet.

**Cause:** Sales Nav lazy-renders search result cards. The cards mount but their interactive contents only paint after a viewport scroll event.

**Recovery:**
1. `computer.scroll` direction down 1 tick (force render via scroll event)
2. Wait 2 seconds
3. `computer.scroll` direction up 1 tick (return to view top)
4. Wait 2 seconds
5. Re-screenshot — result card should now show the chat-bubble Message icon at row position
6. Coordinate-click x=1163 at the row's y-coord (try y=207 first, fallback y=184)

This was the unblock pattern in batch #14: every search rendered initially as an empty `<article>`, scroll-down + scroll-up forced the row contents in.

#### Friction 8 — Chrome MCP session degraded (NEW v2.9, batch #14)

**Symptom:** Multiple Chrome MCP tools (`get_page_text`, `find`, `screenshot`, `javascript_tool`) timeout in succession over a 5+ minute window. `document.body.innerText` returns `"[BLOCKED: Cookie/query string data]"` even on simple pages. Browser is otherwise responsive (you can take screenshots) but DOM extraction is broken.

**Cause:** The Chrome MCP extension's content-script context becomes degraded, often after extended use of `javascript_tool` or after navigating between many heavyweight pages (Sales Nav, public LinkedIn, messaging inbox in same tab). The extension's evaluator hits a state where requests time out at the CDP layer.

**Recovery (locked v2.9):**
1. `tabs_context_mcp({})` — if it returns "No tab group exists for this session", the prior group has been auto-cleaned.
2. `tabs_context_mcp({createIfEmpty: true})` — spin up a fresh tab group in a fresh window.
3. Navigate the new tab to your target URL directly.
4. Resume work on the fresh tab — extension state is reset, tools work normally again.

This is the cleanest reset short of asking Rob to relaunch Chrome. Validated batch #14: prior tab group accumulated ~30 min of friction, fresh tab group via `createIfEmpty` resumed cleanly with 5/5 sends and zero further timeouts.

**When to invoke:** if 2 consecutive Chrome MCP tool calls in <60 seconds time out, OR if `[BLOCKED: Cookie/query string data]` appears even once on a page that previously rendered.

#### Friction 9 — Sales Nav search auto-correct returns 0 results (NEW v3.2, batch #15)

**Symptom:** Navigating to `/sales/search/people?keywords={First}+{Last}+{Company}` returns "Showing results for: {auto-corrected query}" + "0 results found for: {Original Query}". Common when the company name has unusual spelling that LinkedIn's autocorrect "fixes" wrongly. Batch #15 example: `Stori` (the Mexican fintech) auto-corrected to `story`, returned 0 results.

**Cause:** LinkedIn aggressive search autocorrect on company name tokens. Sales Nav favors common-English-word matches over correctly-spelled brand names.

**Recovery (in order):**

1. **Try search with first name + last name only** (drop company token): `keywords={First}+{Last}`
2. **Try search with last name + company only**: `keywords={Last}+{Company}`
3. **Public LinkedIn profile fallback (validated batch #15):**
   - Navigate to `https://www.linkedin.com/in/<slug>/` directly (slug from Apollo `linkedin_url`)
   - From public profile, click "More" → "Save in Sales Navigator" — this opens the Sales Nav lead page directly, bypassing search entirely
   - Capture About + Experience from the lead page panel
4. **If all 3 fail:** drop the candidate to backfill — capture is required per v3.0 evidence-file gate

**Note for Phase 9 send loop:** if the search-then-click-icon path fails for a candidate, you can still send the InMail by:
- Navigate to public LinkedIn profile
- Click "More" → "Save in Sales Navigator"
- On the Sales Nav lead page, click the "Message" button — InMail composer opens

This is slower than the search-and-icon-click path but works around the autocorrect bug.

---

### Send loop credit accounting (per-send, mandatory)

Track per-send to detect lost credits before they accumulate:

| Send # | Recipient | Pre-send credits | Post-send credits | Delta | Outcome | Notes |
|---|---|---|---|---|---|---|

- **Delta = -1** → Paid InMail, delivered ✅
- **Delta = 0** → Open Profile FREE, delivered ✅ (see Open Profile section below)
- **Delta = -1 + no thread + error popup** → INC-030 failure, credit LOST ❌
- **Delta = -2 or more in a single send** → unexpected; STOP and investigate
- **`creditText: NOT FOUND` in post-send check** → likely Open Profile FREE (the "Use 1 of N credits" text doesn't render for OP sends because no credit is being deducted). Take a screenshot to confirm: the composer for OP shows a "Free to Open Profile" badge in the right column where the credit count would be. NOT a failure signal.

### Open Profile detection + handling (NEW v3.2)

**What Open Profile is:** a LinkedIn Premium feature where Premium / Sales Nav / Recruiter users opt their profile into "Open Profile" mode. When enabled, ANY Sales Nav user can send them an InMail **without spending a credit**. The recipient sees it the same as a paid InMail — no functional difference for them. About 15-20% of Director/VP Engineering candidates have it enabled (rough rate from batches #11/#13/#15).

**Detection — three signals, any one is sufficient:**

1. **Composer "Free to Open Profile" badge** — visible in the right column of the InMail composer panel where the credit count usually appears. Verbatim: "Free to Open Profile".
2. **`creditText: NOT FOUND` in post-send JS check** — the "Use N of M credits" text doesn't render in the composer for OP sends. If the regex `/Use \d+ of \d+ credits/` returns no match AND the composer is open, OP is the most likely explanation.
3. **Pre-send delta = 0** — credit balance unchanged after send button click (paired with thread-creation success).

**Handling:**
- Send normally — JS injection + Send button click work the same way.
- Verify success the standard way: thread URL transition + "Awaiting reply from {Name}" message + (for OP) the same composer-empty post-send state.
- In MASTER_SENT_LIST log column 5 = `0` and append `(Open Profile FREE)` to the campaign label, e.g. `LinkedIn InMail (Open Profile FREE)`.

**Strategic note:** Open Profile sends are essentially free reach. Worth tracking the rate per batch to forecast credit-budget runway:
- Batch #11: 1 of 5 OP (Santanu Halder)
- Batch #13: 2 of 5 OP (Sukhmeet, Anoop)
- Batch #14: 0 of 5 OP
- Batch #15: 1 of 5 OP (Sebastian)

Average ~17% OP rate at Director/VP Engineering. At a 5-send batch, expect ~1 free credit save.

**End-of-loop reconciliation:**
- Total credits used = (start balance) - (end balance)
- Total credits delivered = count of "Paid + delivered"
- Credits lost = (Total used) - (Total delivered) — this number should be 0 in clean runs. Any non-zero is INC-030 territory.

Log this reconciliation in the batch tracker post-send.

---

## Post-send — handoff + daily-log update

After all sends complete:

1. Update `memory/session/handoff.md` with:
   - Send timeline table (time, recipient, account, tier, credit, conf)
   - Credit start/end balance
   - Files of record
2. Update `memory/daily-log.md` with the day's batch arc
3. Mark phase tasks completed in TaskList
4. **If 1st-degree spillover exists:** create a DM-batch task for follow-up

---

## Standard credit budget reference

- 5-InMail batch: ~4–6 paid + 0–1 Open Profile FREE expected
- 10-InMail batch: ~8–10 paid + 1–2 Open Profile FREE expected
- Sales Nav Premium gives ~50 InMail credits/month + occasional mid-cycle refills

If credit balance < 2× planned send count, flag to Rob and consider deferring half the batch.

---

## Hard rules (NEVER violate, from CLAUDE.md)

- Work Chrome only (Testsigma profile). Never red/personal Chrome.
- **Apollo work runs main-context only. Never delegate Phase 2/3 to subagents.** (v2.1, locked May 1)
- **TAM-scope verification runs main-context only. Never trust subagent assertions about TAM/Factor/G2 membership.** (v2.3, locked May 1)
- **Phase 0.5 DNC cross-check before sourcing. Phase 1.5 TAM verify after Phase 1. Phase 0.6 prior-contact check + Phase 0.7 degree gate before Phase 4.** (v2.1 + v2.2 + v2.3)
- **Phase 0.6 applies to DM batches too**, not just InMail. Any LinkedIn outreach to a person Rob has a prior thread with becomes a follow-up, not a net-new send. (v2.2)
- **Every draft must score 9/10 minimum at Phase 7.5 before advancing to Phase 8.** No exceptions. Below floor → deeper research, rework, or drop. (v2.4)
- **Phase 7.5 enhancement loop is AUTOMATIC. Never present a sub-9 draft to Rob and ask which path to take.** Run Path A → B → C in order until ≥9/10 or candidate dropped. Halt batch with N strong picks rather than fill with weak ones. (v2.5)
- **No inference in drafts.** Every concrete claim must trace to verified Apollo or LinkedIn evidence. If you have to "guess based on circumstantial evidence", rewrite without that claim or drop the candidate. (v2.4)
- **Phase 0.7.5 deliverability pre-check before Phase 4.** Drop candidates with connections < 20 AND followers < 20 — they're INC-030 risks. Flag thin profiles (< 50/50) to send LAST so credits aren't burned before solid sends complete. (v2.6)
- **INC-030 stop-loss rule: max 1 retry per failed send.** If a send fails (error popup + credit charged + no thread), retry ONCE. If retry fails the same way, drop the candidate, add to DNC list with reason "INC-030 — LinkedIn-side InMail block, N credits lost", and continue. NEVER attempt a 3rd send. (v2.6)
- **Verify failure before retry.** When INC-030 fires, search the recipient name in the inbox first. If "We couldn't find any messages with…" → confirmed no delivery, safe to retry once. If thread exists → first send actually delivered server-side, do NOT retry. (v2.6)
- **Per-send credit accounting is mandatory.** Track pre/post-send credit count per send to detect INC-030 charge-without-delivery in real time. Any unexpected delta triggers stop-loss. (v2.6)
- Never send without explicit "APPROVE SEND" from Rob.
- INC-022 readback is mandatory. Char-for-char body match before Send.
- INC-024 MASTER append is mandatory per send. Don't batch the appends.
- INC-027 strict aria-label match for recipient selection. Never click "first result" by default.
- TAM-only or G2-authorized only. Verify each candidate's company domain against `tam-accounts-mar26.csv` or `sequences/g2-intent/`.
- If browser ops fail, STOP and surface to Rob. No programmatic workarounds for browser-level issues (per CLAUDE.md hard rule).
- Sender from `robert.gorham@testsigma.com` for emails (n/a for InMails — those send under his LinkedIn identity automatically).

---

## Reference files

- `memory/playbooks/inmail-batch-process-v2.md` — full canonical playbook (this skill is the runtime version, locked v2.1)
- `memory/incidents.md` — INC-022 (readback), INC-024 (MASTER gate), INC-027 (single-match), INC-029 (Chrome MCP recovery)
- `memory/sop-tam-outbound.md` — broader TAM outbound SOP
- `memory/playbooks/linkedin-batch-quality-gate.md` — Gate 7 live title lock + Gate 6.5 file persistence
- `CLAUDE.md` — sender rule, voice rules, hard rules, Do Not Contact list

---

## Process maturity log (for context)

| Batch | Date | Sent | Avg Conf | Lesson locked |
|---|---|---|---|---|
| #6 | Apr 29 AM | 2 | 92% | Pre-Apollo-dedup baseline |
| #7 | Apr 29 PM | 10 | 93.6% | Gate 6.5 per-candidate files; recovery protocol |
| #8 | Apr 30 AM | 9 | 94.6% | Deep research v3 uplift on weakest 5 |
| #9 | Apr 30 PM | 5 | 95.2% | **Apollo dedup signal mandatory** (44% Factor drop on first pass) |
| #10 | Apr 30 PM | 5 prepped | 95.4% | 100% Apollo-clean by applying batch #9 lesson upfront |
| #11 | Apr 30 next day | 5 | 97.2% | **Sales Nav deep research mandatory** (3 of 5 hooks upgraded to A+/A++) |
| #12 dry-run | May 1 | 0 (halted) | 93.3% on 3 InMail-ready | **Subagent-leakage ban + Phase 0.5 DNC cross-check + Phase 0.7 degree gate + Phase 1 broaden-survey rule** (locked v2.1) |
| #13 dry-run pt1 | May 1 | 0 (halted) | n/a (100% degree drop) | **Phase 0.6 prior-contact check** — MASTER_SENT_LIST grep + LinkedIn DM thread search per candidate (locked v2.2). All 5 candidates verified clean against MASTER + threads. |
| #13 dry-run pt2 | May 1 | 4 (1 dropped at TAM verify) | — | **Phase 1.5 TAM-scope verification** — Carta surfaced by Phase 1 subagent but failed main-context TAM grep. Locked v2.3. |
| #13 audit | May 1 | — | 8.4/10 batch avg, range 6.5–9.5 | **Phase 7.5 per-prospect confidence gate** — every draft must score 9/10 minimum across formula compliance + traceability + specificity. Below floor: deeper research, hook rework, or drop. Locked v2.4. |
| #13 audit follow-up | May 1 | — | — | **v2.5 — auto-enhancement loop**. Path A → B → C runs automatically when a draft scores <9/10. Skill never asks Rob to choose between sending sub-9 or remediating. By Phase 8, every draft is 9+/10 by construction. |
| #13 send loop | May 1 | 4 of 5 (Christophe failed both attempts via INC-030, 2 credits lost) | — | **v2.6 — Phase 0.7.5 deliverability pre-check + Phase 9 friction handling subsection + INC-030 stop-loss rule + per-send credit accounting**. |
| #14 first-pass | May 1 | 1 InMail-eligible (4 went 1st-degree, 1 prior-sent) | — | **v2.7 — Phase 2.5 LinkedIn pre-screen reorder**. MASTER grep + degree + deliverability now run BEFORE Apollo dedup. Saves ~70% of Apollo credits in network-dense verticals. |

This skill captures the post-#14-first-pass state (v2.7 — credit-efficiency optimized).
