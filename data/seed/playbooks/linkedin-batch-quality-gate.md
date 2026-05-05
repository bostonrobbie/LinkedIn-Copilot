# LinkedIn Batch Quality Gate

**Scope:** Every LinkedIn connection-request batch (Batch A, B, C, D, E...) — both first sends and re-verify passes.
**Locked:** April 24, 2026 after Batch D v0 subagent-fabrication incident.
**Status:** MANDATORY. No LinkedIn batch ships drafts without passing all six gates below.

---

## LOCKED INC-022 DRAFT FORMULA — READ BEFORE WRITING ANY DRAFT

Every LinkedIn connection-request draft across Batch A, B, C, D, and all future batches uses this exact template:

```
Hi {First}, I'm at Testsigma, AI-powered test automation, and I connect with {dept} to share what we're building. Your {hook} is what caught my attention. Happy to connect if that sounds worthwhile. Rob
```

Variables:
- `{First}` — prospect's first name as they use it on LinkedIn
- `{dept}` — contact's department tier, pick ONE: `QA leaders` | `engineering leaders` | `automation leaders` | `QE leaders`. Match to prospect's actual title (Automation/SDET titles → "automation leaders"; QA Manager/Analyst/Lead → "QA leaders"; SW Eng Mgr → "engineering leaders")
- `{hook}` — per-contact anchor traced to evidence. Hook construction rules are in Gate 5 below.

**Rigid format constraints:**
- **Signoff is inline:** "...worthwhile. Rob" — NOT on a new line, NOT "- Rob", NOT "— Rob"
- **No em dashes** anywhere in the draft
- **No question marks**
- **Character length 229-278** (LinkedIn connection-note hard cap is 300; 229 floor is the Batch A-through-C observed minimum for reply-quality)

**Reference examples (all sent in Batch C rev-4 successfully, 22 of 23 delivered):**
```
Hi Alex, I'm at Testsigma, AI-powered test automation, and I connect with engineering leaders to share what we're building. Your recent move into the Software Engineering Leader seat at StubHub is what caught my attention. Happy to connect if that sounds worthwhile. Rob
```
```
Hi Umair, I'm at Testsigma, AI-powered test automation, and I connect with QA leaders to share what we're building. Your three-plus years as Sr. IT QA Testing Lead at Ryder is what caught my attention. Happy to connect if that sounds worthwhile. Rob
```
```
Hi Cristinel, I'm at Testsigma, AI-powered test automation, and I connect with engineering leaders to share what we're building. Your role as Senior Software Engineering Manager at SugarCRM is what caught my attention. Happy to connect if that sounds worthwhile. Rob
```

If a draft does not match this template letter-for-letter in the fixed parts, it is OFF-FORMULA and must be rewritten before QA.

---

## Why this exists

Batch A (Apr 13) to Batch C rev-4 (Apr 24) produced specific, replayable failure modes:

- **INC-022 (Apr 13):** 20 of 24 messages got rewritten on-the-fly with wrong personalization. Recipient Jeb Watkins called it "AI bot spam." → Fixed by character-for-character readback at send time.
- **Cristinel/Umair pattern (Apr 23):** Sales Nav public banner title differs from Experience-entry title. "QA Manager" displayed but Experience says "Sr. IT Quality Assurance Testing Lead." → Hooks must trace to Experience entry.
- **Cristinel/Raghda staleness (Apr 23):** "Your move up to..." was factually accurate but stale at 1 yr 9 mos tenure — not a "recent" move anymore. Reads as lazy research. → Framing hard rule: no "recent move into" if tenure >12 months.
- **INC-023 Cyril Muhlenbach (Apr 24):** LinkedIn showed "Pending" state in More dropdown. No record in MASTER_SENT_LIST. Accidentally near-sent a duplicate. → Pre-send Pending check is now mandatory.
- **INC-024 Batch D subagent fabrication (Apr 24):** Apollo-prospecting subagent fabricated 8 Chase+Fidelity LinkedIn URLs that 404'd live. Backup-pool subagent fabricated 11 of 12 candidate identities (wrong names, wrong companies). → Apollo calls must be direct from main context with file-based grep verification.

This playbook is what prevents these from recurring.

---

## The six quality gates

### Gate 1 — Sales Nav Lead Page Capture (per contact, MANDATORY)

Before any draft is written:

1. Obtain the candidate's Sales Nav URN (via Sales Nav search or URN-direct URL)
2. Navigate to `https://www.linkedin.com/sales/lead/<URN>,NAME_SEARCH,<hash>`
3. Capture via DOM read:
   - **Current role — Experience entry title** (not the banner, not Apollo's title field) — verbatim
   - **Start date** (shown on Experience entry, e.g. "Sep 2024–Present 1 yr 8 mos")
   - **Tenure in months** (calculated from start)
   - **Degree** (2nd / 3rd / 3rd+ / 1st — if 1st, skip; already connected)
   - **Location** (Sales Nav banner)
   - **Buyer intent flag** if present on account
   - **Recent activity** — any post/comment in last 90 days, with 1-line summary
   - **Prior employer transition signal** — if Sales Nav shows recent company switch in Experience timeline

4. Write the captured data to an evidence file (`batches/active/<batch>/research-<contact>.md` or consolidated `batch-<X>-evidence.md`). Source-of-truth for the draft's hook.

**If Sales Nav cannot be accessed** (profile private, redirect error, 404): flag the candidate SKIP and replace with a backup. Do NOT write a draft from Apollo data alone.

### Gate 2 — Public-Profile Slug Preflight (per contact, MANDATORY)

After Sales Nav capture, before the candidate is added to the send list:

1. Navigate to `https://www.linkedin.com/in/<slug>/` (the public-profile URL)
2. Confirm:
   - Page title matches "{Name} | LinkedIn" — name must be recognizably the same person as Sales Nav capture
   - Page shows a current-employer match to Sales Nav
   - Page shows a Connect button (direct in main section OR under "More" dropdown)
3. Classify:
   - **CLEAN_MATCH**: send
   - **NAME_VARIANT**: minor last-name transliteration or marriage-name — verify first-name match + company match, then send
   - **WRONG_PERSON** (different first name OR different company): SKIP and replace
   - **STALE_404**: SKIP and replace
   - **PRIVATE**: SKIP and replace

**First-name accuracy is non-negotiable.** The greeting "Hi {First}" must match the name the person actively uses — pulled from the LIVE Sales Nav / public profile, not from Apollo's `first_name` field. Apollo's name field drifts; the live page does not.

### Gate 3 — Public-vs-Internal Title Reconciliation

Sales Nav shows two titles in two places:

- **Banner title** (top of lead page): may be the user's customized LinkedIn headline — often simplified
- **Current Role Experience entry**: verbatim from the job experience record — full formal title

If they differ, **the Experience entry title is source of truth for the hook.** If the banner says "QA Manager" but Experience says "Senior IT Quality Assurance Testing Lead," use the Experience title — it's the one LinkedIn classifies him as in their internal graph and matches what Apollo sees. The recipient won't be offended; it matches the role they actually hold in their record.

Confirmed examples from Batch C rev-4 (Apr 23 2026):
- Umair Salam — banner "Sr. Quality Assurance Lead" vs Experience "Sr. IT Quality Assurance Testing Lead" — used Experience, clean send
- Cristinel Mitoi — banner "Software Engineering Manager" vs Experience "Senior Software Engineering Manager" — used Experience, clean send

### Gate 4 — Pre-Send Pending Check (MANDATORY at send time)

Before clicking Connect on any candidate:

1. Load the public profile
2. If Connect is visible as the primary action slot — proceed
3. If Connect is NOT visible (e.g. "Follow" or "Message" is primary):
   - Click the "More" dropdown
   - Check the options list for:
     - **"Connect"** — proceed via dropdown
     - **"Pending"** — STOP. Do not re-send. Log candidate as SKIP with reason "existing Pending state, no prior MASTER record" (this is the INC-023 Cyril pattern; needs reconciliation investigation before any future re-send)
     - **"Remove Connection"** or indication of 1st-degree — SKIP as already-connected

This check is what Batch C rev-4 saved. Without it, we'd have accidentally double-invited Cyril Muhlenbach.

### Gate 5 — Staleness Framing Ban

The locked formula reads: "Your {hook} is what caught my attention."

Hook construction rules:
- If tenure-in-role **<12 months**: "recent move into..." / "recent promotion to..." is defensible. Pair with Sales Nav "Recently promoted" badge when present (stronger signal, like Shahin Fard).
- If tenure-in-role **12-24 months**: use role + title framing. Examples:
  - "role as Senior Software Engineering Manager at SugarCRM" (Cristinel, 1 yr 9 mos — rev-4 patch)
  - "Quality Assurance Manager role at Procore, after 11+ years at IBM Egypt" (Raghda, 1 yr 8 mos Procore + 11 yr IBM contrast — rev-4 patch)
- If tenure-in-role **>24 months**: emphasize tenure depth
  - "3+ years as Sr. IT QA Testing Lead at Ryder" (Umair, 3 yrs 1 mo)
  - "10+ years as QA Manager at Anaplan" (Iain, 10 yrs 6 mos)
  - "20-year career in software QA at Bomgar through the BeyondTrust era" (Paul, 20 yrs 3 mos — rev-4 patch: "career" not "tenure running" because his first 7 yrs were IC Lead QA Engineer, not management)

**"Recent move into" / "Recently promoted" with tenure >18 months reads as lazy research and is banned.**

### Gate 6 — No Subagent Apollo Trust (INC-024 Lock, reinforced Apr 24 PM)

Apollo calls (`apollo_people_match`, `apollo_people_bulk_match`, `apollo_mixed_people_api_search`) **cannot be delegated to subagents, period.** Any subagent asked to make Apollo calls is a protocol violation regardless of what output it produces. Three repeat fabrication failures observed on Apr 24 — even with strict trust-but-verify protocols, subagents return fabricated verification results that look legitimate at first glance.

**Why:** Batch D first pass had subagents that:
- Fabricated 8 Chase/Fidelity LinkedIn URLs that 404'd live (e.g. `dhanalaxmi-kanakala-426b6b72` — real Apollo record showed `dhanalaxmi-kandibanda-132524b`)
- On a backup-pool re-lookup, returned 11 of 12 candidates with entirely different names and companies than requested (e.g. input "Emely Herrera GEICO" → subagent returned "Raghava Surya Mastercard")

Apollo MCP outputs are ~75-80k chars per candidate (full profile history). The correct flow is:

1. Call `apollo_people_match` with the Apollo ID directly from main context (the tool will save the output to disk if over context limit)
2. Use `Grep` on the saved file for `"linkedin_url"|"name":|"title":|"city":|"organization_name"` to extract the real fields
3. Build the candidate record from the grep output, not from any subagent synthesis

Subagents CAN:
- Read a file already on disk and summarize it
- Navigate LinkedIn URLs and report observed content (slug preflight — Gate 2)
- Write a file if given explicit structure instructions with verification (and main-context must spot-check)

Subagents CANNOT:
- Be the sole source of Apollo field values
- Be trusted to fill missing data (they fabricate)
- Verify their own output without independent main-context re-check

### Gate 7 — Pre-Send Live Title Lock (INC-026 Lock, Apr 27, 2026 — v2)

**Mandatory per contact, no exceptions.** Apollo and Sales Nav and subagent data are reference inputs only. The personalization claim in every draft hook MUST trace to a verbatim main-context Chrome MCP capture of the contact's public LinkedIn profile, captured ≤24 hours before send.

**Required per-contact capture (v2 — headline AND Experience entry):**
- Main-context Chrome MCP `get_page_text` on `https://www.linkedin.com/in/<slug>/` (load with enough wait for Experience section to populate, OR navigate directly to `/details/experience/`)
- Captured fields:
  - **Headline** — the line under the contact's name in the top card (free-text field; contact may customize)
  - **Most recent Experience entry** — title + employer + start date + computed tenure
  - Per Gate 3, the **Experience entry is source of truth** for the role. The headline is reference only — contacts often display aspirational or simplified headlines that don't match their actual Experience entries.
  - Connection degree, location, mutual connection count, profile URL, capture timestamp
- Persisted to `batches/active/<batch>/evidence-live-titles.md` with one block per contact

**Tenure data — main-context capture only.**
Subagent tenure claims are NOT acceptable. Sub 1 (Apr 27) and Sub C (Apr 27) both shipped wrong tenure data ("8 mo" vs actual 2yr 10mo for Sana; "11 mo" vs actual 2yr 11mo for Subhi). Tenure must be read off the Experience entry start-date string in the live capture.

**Required per-draft tracker entry:**
- New field `Live Title (captured):` quoting verbatim from the evidence file
- Hook must contain the live title verbatim or a documented faithful derivation. Examples of acceptable derivation: "QA Lead at Chase" → "twelve-plus years as QA Lead at Chase" (tenure backed by separate evidence). NOT acceptable: live title says "Software Engineer in Test" and hook says "Sr QA Automation Engineer."

**Subagent and Apollo data are NOT acceptable sources for the Live Title field.** Subagents may extract data from already-captured evidence files but may not be the live capture step.

**Send-loop guard (runs BEFORE INC-022 readback per contact):**
1. Load `Live Title (captured):` field for current contact from evidence file
2. Load draft text from tracker
3. Verify draft text contains the live title verbatim, OR contains a derivation token (employer name + role keyword) found in the live title
4. If mismatch, halt the entire batch send and re-present
5. Only after Gate 7 guard passes does the INC-022 readback fire

**Failure modes Gate 7 closes:**
- Apollo title staleness (Sana, Sai, Ying, Adrian Marcau on Apr 27)
- Subagent capture fabrication (Sub C / Sub G' on Apr 27, INC-024 on Apr 24)
- Stale title from Sales Nav internal vs public Experience entry
- Persona pivot since prospecting (e.g. SDET → general SW Eng)

**Why:** INC-026 (Apr 27, 2026). Five of 22 Batch F drafts had wrong titles or stale tenure that the prior six gates did not catch. The QA Gate Summary checked formula compliance (char count, dashes, signoff format) but not factual accuracy of the personalization claim. Send 1 of 22 caught Sana's mismatch live; without that catch we would have sent at least two factually wrong messages.

### Evidence file structure

Every LinkedIn batch produces, in its `batches/active/<batch-name>/` folder:

- `account-inventory.md` — Factor + TAM account state (touched/untouched)
- `candidate-pool-v1.md` — Apollo prospecting output, with main-context verification column
- `batch-<X>-shortlist-<date>.md` — 25-person shortlist with account-diversity rationale
- `slug-preflight.md` — Gate 2 output per candidate
- `batch-<X>-evidence.md` — consolidated Sales Nav research (Gate 1) per contact
- `evidence-live-titles.md` — **Gate 7** main-context live profile captures per contact (mandatory)
- `batch-<X>-send-ready.md` — final drafts source-of-truth, INC-022 + Gate 7 compliant
- `<batch>-sends.json` in `batches/sends-json/` — structured manifest

At least one evidence artifact must exist per contact. If a candidate has no Sales Nav research in the evidence file OR no live title capture in `evidence-live-titles.md`, they cannot be in the send-ready file.

---

## Checklist (paste into every new batch kickoff)

- [ ] Account inventory built from tam-accounts-mar26.csv
- [ ] 30-50 candidates surfaced with main-context Apollo calls (not subagent-fabricated)
- [ ] 25 selected with account-diversity weighting
- [ ] Gate 1: Sales Nav lead page captured for each 25 (title + tenure + activity + degree)
- [ ] Gate 2: Slug preflight clean for each 25 (or replacement sourced)
- [ ] Gate 3: Public vs Experience title reconciled per candidate
- [ ] Gate 7: Live title capture in evidence-live-titles.md for each candidate, ≤24h before send
- [ ] Each draft tracker entry has `Live Title (captured):` field quoting from evidence file
- [ ] Each draft hook contains live title verbatim or documented faithful derivation
- [ ] Hook tenure-framing respects Gate 5 (no "recent move" >18mo)
- [ ] 25 drafts written to send-ready file
- [ ] Strlen 229-278 per draft, 0 em-dashes, 0 question marks, "Rob" signoff no dash
- [ ] Rob APPROVE SEND
- [ ] Gate 7 send-loop guard fires per contact BEFORE INC-022 readback
- [ ] Gate 4: Pending-state check before each Connect click
- [ ] INC-022 readback match before each Send click
- [ ] INC-024 MASTER_SENT_LIST append after each successful send
- [ ] Post-send handoff update

---

## Cross-references

- `memory/sop-outreach.md` — LinkedIn draft formula
- `memory/sop-send.md` — Send execution protocol
- `memory/playbooks/linkedin-send-preflight.md` — Pre-send technical checks
- `memory/incidents.md` — INC-022, INC-023, INC-024 full incident history
- `CLAUDE.md` Hard Rules → "LinkedIn Sales Navigator Research is MANDATORY" section

---

## Apr 24 2026 addendum — Batch D v1 learnings

**Persona-drift pattern (Gate 1 mandatory catch):** Apollo `title` field can be months-to-years stale on a contact. Three Batch D v1 candidates had Apollo saying "QA Manager" / "QA Analyst" while live Sales Nav showed completely different personas:

- **Himanshu Sharma (TELUS Digital)** — Apollo claimed "Quality Assurance Manager." Live Sales Nav showed "Recruitment Sr Team Leader | Talent Acquisition/Recruitment." Moved out of QA into recruiting. **Dropped.**
- **Martin Bernardo (Datamatics)** — Apollo claimed "Quality Assurance Manager." Live LinkedIn showed "Manager - Transactional Quality" — BPO/call-center transactional quality metrics, not software QA. **Dropped.**
- **Sai Srinivas (Corewell Health)** — Apollo claimed "Lead QA Analyst." Live LinkedIn showed "Healthcare QA Analyst | Data Analyst | Systems Analyst" — clinical/healthcare QA, not software QA. **Dropped.**

**Rule Lock:** Gate 1 Sales Nav Experience entry title is the ONLY acceptable input for hook construction. If it contradicts Apollo's persona claim, drop the candidate entirely — do not attempt to "still draft something." Three out of fifteen Batch D v1 = 20% drop rate from Apollo-vs-live drift. Expect similar drift rate on every future batch sourced from Apollo.

**Connect button position variance (Gate 4 addendum):** Connect button y-coordinate on the public profile varies by headline length:
- Short/one-line headline (e.g. "SR SDET") → Connect at approximately `(294, 347)`
- Multi-line headline (e.g. Shraddha's stack of tech keywords) → Connect at approximately `(294, 373)`
- Rich headline with subtitle (e.g. Jaideep's pipe-separated skills string) → Connect at approximately `(294, 373)`

The JS aria-label position-filter (`r.top>100 && r.top<500`) sometimes falls through when the button renders slightly below 500px in multi-line headline cases. Fallback pattern: if JS `clicked: false` → take a `screenshot` → visually locate the blue Connect button → `left_click` on coordinate. Do NOT use More-dropdown fallback when direct Connect is visually present; save that for profiles where Connect is genuinely absent from primary slot (like Vladimir in Batch C rev-4).

**Send-time resilience observed:** all 12 Batch D v1 sends succeeded with per-send readback match + toast confirmation + MASTER_SENT_LIST append. Same pattern as Batch C rev-4 (22/23 successful). The main execution risk is the Connect-button-click step, not the readback/send step.
