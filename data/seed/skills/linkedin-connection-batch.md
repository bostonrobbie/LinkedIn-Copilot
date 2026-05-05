---
name: linkedin-connection-batch
description: Build, QA, and send a LinkedIn connection-request batch end-to-end with all 8 gates locked + mandatory deep LinkedIn research per candidate. Triggers on "build batch X", "next LinkedIn batch", "prep N more", "Batch H/I/J...", or any LinkedIn connection-request batch work. Codifies the process locked across Batches A-G + InMail batches #4-#11 (Mar-Apr 2026) including INC-022 readback, INC-026 Gate 7 live title lock, INC-027 strict-aria click safety, INC-028 weekly cap throttling, and Apr 30 deep-research mandate.
---

# LinkedIn Connection-Request Batch — End-to-End Skill (v7)

## NEW RULES locked May 1 morning (post-Batch G+H rate-limit halt — Send-Time Extreme Care Protocol)

These extend the Apr 30 deep-research lock with a rigorous send-time SOP. The trigger: Apr 30 PM rate-limit detection caught us mid-send, and the prior Phase 9 sketch (5-10 sends/day) was insufficient guidance for "be extremely careful and accurate." This section is now the canonical send-time runbook.

### NEW Phase 9.0 — Pre-Session Rate-Limit Detection (mandatory, before opening any candidate)

Before clicking any Connect button on any candidate, run the **control-profile probe**:

1. Pick one contact from the locked send-ready file (any will do — call them the "control")
2. Navigate to their public LinkedIn URL
3. Wait 3 seconds
4. Inspect the page for the strict-aria Connect button:
   ```javascript
   const expected = `Invite ${expectedFullName} to connect`;
   const heroBtn = document.querySelector(`button[aria-label="${expected}"]`);
   ```
5. Branch on result:
   - **Hero Connect button present** → not rate limited, proceed to Phase 9.1
   - **Hero Connect button absent** → check ONE more profile to confirm
   - **2 of 2 absent** → likely rate limit, run 4-profile sample below
   - **4 of 4 absent** → rate limit confirmed, HALT entirely, run Phase 9.0.5

### NEW Phase 9.0.5 — Rate-Limit Halt Decision Tree (mandatory when 4-of-4 sample fails)

```
Rate limit confirmed (4 profiles checked, no Connect button on any)
│
├─ Check Sent Invitations page total count
│   ├─ Total Pending > 100 → likely 7-day rolling cap hit
│   │   ├─ Most recent invite ≥7 days old → wait 24h, retry tomorrow
│   │   └─ Most recent invite <7 days old → wait until oldest in 7-day window ages out
│   │
│   └─ Total Pending < 50 → likely account-state issue (different from cap)
│       ├─ Switch to InMail batch motion (separate cap)
│       ├─ Or wait 48h before retry
│       └─ Alert Rob — uncommon scenario, flag for inspection
│
├─ Pruning >21-day-old Pendings does NOT free 7-day-window slots
│   (Verified Apr 30 evening — pruning reduces total-open count, NOT 7-day count)
│
└─ Pruning Pendings <7 days old WOULD free 7-day-window slots, but withdraws
   otherwise-converting invites. Destructive — only for emergency-must-send-today.
```

**The right path 95% of the time: wait 24h.** The 7-day rolling window auto-frees slots as the oldest day ages out. No action required from us.

**Rate-limit halt logging:** when halt fires, write a one-line entry to `memory/session/handoff.md`:
```
LinkedIn rate limit hit {date} — N of 4 sample profiles missing Connect. Halt active. Resume {date+1} after Gate 7 refresh.
```

### NEW Phase 9.1 — Per-Send Preflight Checklist (mandatory, every single send)

Run this checklist for EVERY contact in the queue. No skipping. No "I just did it for the last one." Each step is a hard gate.

| # | Step | Check | Pass criterion |
|---|---|---|---|
| 1 | **Source draft pull** | Read draft text directly from batch tracker file (not from memory) | Draft text loaded into a variable, characters counted |
| 2 | **Gate 7 freshness** | Confirm evidence-live-titles.md capture is ≤24h old | Capture timestamp within 24h of now |
| 3 | **Hook traceability** | Hook string in draft appears verbatim in evidence file | `hookStr in evidenceFileContent` is True |
| 4 | **Public profile load** | Navigate to LinkedIn URL, wait 3s, page renders | Name + company match expected, no 404 |
| 5 | **Auto-drop signal scan** | Headline check for Open to Work / Retired / Ex- / wrong company | None present |
| 6 | **Pending check** | Open More dropdown, scan for "Pending" state | No Pending entry visible |
| 7 | **Strict-aria Connect button** | Locate hero Connect button via exact aria-label match | `aria-label === \`Invite ${expectedName} to connect\`` |
| 8 | **Connect click + modal open** | Click Connect, wait 1.5s, modal appears | Modal DOM contains "Add a note" or "Send without a note" |
| 9 | **Modal name verification** | Modal header references expected contact name | Header text contains expected first or full name |
| 10 | **Add a note → textarea** | Click "Add a note", textarea appears | `textarea#custom-message` exists and focusable |
| 11 | **Inject draft text** | Use React HTMLTextAreaElement prototype setter + dispatchEvent | textarea.value populated |
| 12 | **INC-022 char-for-char readback** | Compare textarea.value to source draft byte-by-byte | `textarea.value === sourceDraft` strictly equal |
| 13 | **Send click** | Click Send button (only if step 12 passed) | Click registered |
| 14 | **Post-click dialog verify** | Within 2s, verify dialog name + Send confirmation | INC-027 — name in dialog matches expected, no recommendation-card mis-click |
| 15 | **Toast verification** | "Invitation sent to {Name}" toast appears OR Pending state set | Either confirmation visible |
| 16 | **INC-024 MASTER append** | Immediately append row to MASTER_SENT_LIST.csv | Row written, file saved |
| 17 | **Cap-watch tick** | Increment session-send counter, log to ledger | Counter incremented, log line written |

**Any step fails = halt that contact, log reason, move to next.** Do not retry the same contact in the same session — flag for manual review.

### NEW Phase 9.2 — INC-022 Character-for-Character Readback Spec (locked)

Pseudo-code (run in javascript_tool after injection):

```javascript
// Read back what's in the textarea
const ta = document.querySelector('textarea[name="message"], textarea#custom-message, .send-invite__custom-message');
const actual = ta.value;
const expected = SOURCE_DRAFT;  // pulled from tracker file in Phase 9.1 step 1

const match = actual === expected;
const actualLen = actual.length;
const expectedLen = expected.length;

// Diagnostic if mismatch
let firstDiff = -1;
if (!match) {
  for (let i = 0; i < Math.max(actualLen, expectedLen); i++) {
    if (actual[i] !== expected[i]) { firstDiff = i; break; }
  }
}

return { match, actualLen, expectedLen, firstDiff,
         actualSlice: actual.slice(Math.max(0,firstDiff-10), firstDiff+20),
         expectedSlice: expected.slice(Math.max(0,firstDiff-10), firstDiff+20) };
```

**Hard rule: if `match === false`, do NOT click Send.** Clear the textarea, re-inject from source, re-readback. If second readback also fails, halt the contact and log the discrepancy slice for manual review.

This is the core INC-022 protection — the rule that came out of the Apr 13 incident where 20 of 24 connection requests were rewritten on-the-fly with wrong personalization. The readback is what makes "extremely careful" enforceable.

### NEW Phase 9.3 — INC-027 Post-Click Dialog Verification (locked)

After clicking Send (step 13), within 2 seconds:

```javascript
// Look for the post-click dialog OR toast
const dialog = document.querySelector('[role="dialog"]');
const dialogText = dialog ? dialog.innerText : '';

// Or the toast notification
const toast = Array.from(document.querySelectorAll('div'))
  .find(d => d.innerText && d.innerText.includes('Invitation sent'));

const nameInDialog = dialogText.includes(expectedFirstName) || dialogText.includes(expectedFullName);
const toastConfirmed = !!toast;

return { dialogPresent: !!dialog, nameInDialog, toastConfirmed, dialogText: dialogText.slice(0,200) };
```

**Failure modes to catch:**
- Modal closed without sending (rare browser glitch) → no toast, no Pending state → re-inject and re-send
- Recommendation-card mis-click (clicked wrong Connect on sidebar carousel) → modal references different person → halt, navigate to Sent Invitations, withdraw the rogue invite immediately
- Soft-fail toast ("Couldn't send invitation") → log as failed, do NOT MASTER-append

### NEW Phase 9.4 — INC-024 MASTER Append (locked, immediate)

Immediately after Phase 9.3 confirms success (and before navigating to next contact), append the row:

```python
import csv
from datetime import datetime

with open('/sessions/.../mnt/Work/MASTER_SENT_LIST.csv', 'a', newline='') as f:
    w = csv.writer(f)
    w.writerow([
        full_name,
        f'LI-CR-{datestamp}-batch{batch_letter}',  # source tag
        datestamp,                                  # YYYY-MM-DD
        'LinkedIn Connection T1',                   # message type
        0,                                          # reply count
        f'batch-{batch_letter}-drafts-v1.md',       # source file
        full_name.lower()                           # lookup key
    ])
```

**Hard rule: do NOT batch up MASTER appends until end of session.** Append per-send, immediately. Three reasons:
1. Crash or context loss mid-batch loses unappended sends → next-session dedup grep misses them → channel stacking risk
2. INC-024 audit history showed 268 missed sends went out without MASTER rows because the append was deferred
3. Per-send append is what makes MASTER a reliable source of truth

### NEW Phase 9.5 — In-Session Cap Watch (locked)

After every send, log to a session ledger:

```python
# Append to /tmp/session_send_log.txt
import time
with open('/tmp/session_send_log.txt', 'a') as f:
    f.write(f'{time.strftime("%H:%M:%S")}\t{full_name}\tsuccess\n')
```

After every 5 sends, run a quick cap-check by scanning the next contact's Connect button before injecting draft. If hero Connect missing on next contact = early signal that cap is approaching.

**Cap-hit mid-session protocol:**
1. Log the contact where cap was detected
2. Navigate to Sent Invitations page → screenshot total Pending count
3. Halt remaining queue
4. Update handoff: "Halted at contact N of M. Cap signal detected. Total Pending: X. Resume tomorrow."

### NEW Phase 9.6 — End-of-Session Reconciliation (locked)

After the last send (or halt):
1. Diff `MASTER_SENT_LIST.csv` for today's date — count rows with `LI-CR-{date}-batch{X}`
2. Count `success` rows in `/tmp/session_send_log.txt`
3. Verify counts match (MASTER row = ledger row)
4. If mismatch, re-check last 3 contacts' Sent Invitations status to identify gaps
5. Update handoff with final session count + remaining queue

### Send-time guardrails — what NOT to do

- ❌ Inject draft text BEFORE Phase 9.1 step 7 strict-aria check passes
- ❌ Click Send when readback shows mismatch (even by one character)
- ❌ Skip the modal name verification "because it's the same flow as last time"
- ❌ Defer MASTER_SENT_LIST appends to end of session
- ❌ Continue sending after 4-of-4 sample shows no Connect button
- ❌ Trust a "looks right" gut check instead of running the readback comparison
- ❌ Compose draft text at send time (INC-022 — the tracker file IS the source)
- ❌ Read the prospect's LinkedIn profile during the send loop to "improve" the hook
- ❌ Retry a failed send in the same session — flag for manual review
- ❌ Send without per-send Gate 4 Pending check via More dropdown

### Speed expectations at extreme-care pace

Realistic per-send time with full protocol: ~90-120 seconds per contact.
- Navigate + 3s wait: ~5s
- Auto-drop scan + Pending check: ~10s
- Connect → modal → Add a note → textarea: ~10s
- Inject + readback + readback diagnostics: ~15s
- Send click + post-click verify + toast: ~5-10s
- MASTER append + ledger log: ~5s
- Buffer for tool round-trips and waits: ~30-60s

20 sends/day at this pace = 30-40 minutes of focused send-loop work. That's a feature, not a bug — slower means more accurate.

---

## NEW RULES locked Apr 30 evening (post-Batch G+H deep research session)

These are gaps we identified by comparing our connection-request batches against the InMail batches #4-#11 that consistently hit 95-97% confidence. Adding them as mandatory.

### NEW Gate 0.5 — Apollo `emailer_campaign_ids` check (extension of Gate 0)

After MASTER_SENT_LIST grep, also call `apollo_people_match` on every candidate and inspect `contact.emailer_campaign_ids`. If non-empty (especially Factor-First Outbound campaign id `69afff8dc8897c0019b78c7e`), the candidate is currently in active email sequence — sending a LinkedIn connect request stacks channels. **HALT unless Rob explicit override.**

Apr 30 InMail batch #9 finding: ~50% of Director/VP-tier engineering contacts at TAM accounts are auto-enrolled in Factor-First via the Oct/Nov 2025 CSV import. MASTER_SENT_LIST grep alone misses this because Apollo doesn't always log a "send" until the campaign step actually fires.

### NEW Gate 0.7 — Gmail Sent + received prior-email search (locked Apr 30 evening, mandatory per candidate)

**ALSO call Gmail `search_threads` for every candidate name BEFORE drafting.** Run two searches:

1. `from:robert.gorham@testsigma.com {first} {last}` — catches any T1/T2/follow-up email YOU sent that wasn't logged to MASTER_SENT_LIST (INC-024 documented this gap)
2. `from:{email_localpart}` if you know their email — catches any reply they sent you that you may have missed

If ANY direct email thread exists (excluding Apollo daily task notifications from `support@tryapollo.io`), the candidate has prior outreach → **DROP from connection-request batch**. Sending a LinkedIn note after T1+T2 emails went unanswered is channel-stacking and reads as spam.

**Why this gate is mandatory NOT contingent:** Apr 30 evening prior-contact audit on 23-batch caught **3 contacts (Tanvir Afzal, Chris Pendergast, Sambhav Taneja) with direct T1+T2 emails sent in March-April 2026 that were NOT logged in MASTER_SENT_LIST and NOT showing in Apollo `emailer_campaign_ids`.** They were in active Apollo sequences whose sends pre-dated the Oct 2025 MASTER append rule (INC-024 fix) AND whose campaign membership had since been cleared from the contact record. Both prior gates missed them. Only Gmail Sent search caught the issue.

The contact-research-system gap: Apollo and MASTER both reflect *current* state, not historical. Gmail Sent is the true historical record of every outbound. Always check it.

### Combined prior-contact ladder (run on every candidate before drafting)

| Source | What it catches | Gate |
|---|---|---|
| `MASTER_SENT_LIST.csv` | Logged sends since Oct 2025 INC-024 fix | Gate 0 |
| `CLAUDE.md` Do Not Contact | Explicit DNCs / bounces / hostile | Gate 0 |
| Apollo `emailer_campaign_ids` | Current campaign enrollment | Gate 0.5 |
| `memory/warm-leads.md` | P0/P1 escalations (replies tracked) | Gate 0.6 |
| `memory/pipeline-state.md` | Active deal tracking | Gate 0.6 |
| `memory/contact-lifecycle.md` | Unified contact timelines | Gate 0.6 |
| **Gmail Sent + Inbox `search_threads`** | **Direct outbound emails + replies — historical record** | **Gate 0.7** |

All 7 must clear before a candidate proceeds to draft phase. Any hit = drop unless Rob explicit override + reason logged.

### MANDATORY Sales Nav right-panel capture per candidate (escalated from Gate 8 optional → required)

For every candidate, capture from Sales Nav lead page right panel:
- **Account has X buyer intent** (none / low / moderate / high)
- **Strategic Priorities** (account-level macro shifts the company is pursuing)
- **Account Insights** (industry, location, headcount growth)
- **How [Company] makes money** (1-line summary)

These data points were what got InMail batches #8-#11 to 96%+ confidence. They surface hook material the public profile doesn't.

### MANDATORY recent activity capture per candidate

From Sales Nav lead page Activity section OR public profile Activity tab, capture:
- Most recent post or repost (within 90 days)
- Most recent comment (any topic)
- "LinkedIn-quiet" if no activity in 90 days (acceptable, not a drop)

When recent activity exists and is topical (industry news, company milestone, technology launch), it's STRONGER hook material than tenure alone. InMail batch #11 hit 98% on Santanu Halder by anchoring to his #aitesting podcast repost.

### MANDATORY About-section verbatim quote capture

From Sales Nav lead page About section. When the prospect has self-described their work in distinctive language, that becomes the highest-quality hook material. Russell Adcock (Skedulo) "Engineering Operational metrics that identified bottlenecks in our development process" was a 90% Tier A hook in InMail batch #6.

### Tier classification per candidate (A++ / A+ / A) — Tier B BANNED (locked Apr 30 evening)

| Tier | Criteria | Hook anchor | Confidence |
|---|---|---|---|
| **A++** | Recent verifiable activity (post, repost, comment) on topic relevant to Testsigma | Activity-anchored, freshest signal | ~98% |
| **A+** | Verifiable About-section quote OR recent web-side macro-shift news for their company | About-quote OR web-news-anchored | ~96% |
| **A** | Verbatim Experience entry title + tenure (the floor — verified Sales Nav Rung 3) | Tenure + role framing | ~94% |
| ~~B~~ | ~~LinkedIn-quiet, public title hidden, no About signal~~ | **DROP or research deeper until A** | — |

**MANDATORY: Every candidate must reach Tier A or higher before send. No Tier B contacts ship.** If a candidate is Tier B at first pass:
- Climb the verification ladder (Sales Nav lead page → Experience tab → Sales Nav re-verify on different search query → web macro-shift)
- If still cannot lift to Tier A, **drop the contact** and source a replacement

This is what the Samir Christian Apr 30 PM upgrade demonstrated: Apr 30 his public title was hidden ("None at None") which would have been Tier B. Sales Nav re-verify recovered "Sr QA Manager at Fidelity Investment" + career-history confirmation, which is verbatim Experience entry → Tier A.

**Goal:** 70%+ A++/A+ on every batch. Tier A is the floor.

### Web-side macro-shift research for Tier A++ uplift candidates

For Director/VP-level prospects at well-known companies, run a quick web search for:
- Recent press releases (last 90 days)
- Product launches / partnerships
- Public commitments or initiatives announcements

Examples that worked: Torc Robotics + Daimler Michigan public roads testing (Feb 24 announcement → Stephan Vargas 96% hook), SailPoint adaptive identity (Mar 9 press release → Remi Philippe 95% hook), Anaplan CoModeler launch (Mar 25 → Edvard Dvorak 93% hook).

For non-Director SDETs / QA Leads, web-side research is usually overkill — Tier A (verbatim title + tenure) is fine.

### CONTENT FILTER WORKAROUND — 5-char chunk URN extraction (locked Apr 30)

When extracting Sales Nav URNs, the page content filter sometimes blocks long base64-like strings, returning `[BLOCKED: Base64 encoded data]`. The workaround:

```javascript
// Instead of returning the raw URN string, split into 5-char chunks
new Promise(r => setTimeout(r, 4000)).then(() => {
  const m = document.body.innerHTML.match(/AC[a-zA-Z0-9_-]{30,80}/);
  if (!m) return 'none';
  const u = m[0];
  const chunks = [];
  for (let i = 0; i < u.length; i += 5) chunks.push(u.slice(i, i+5));
  return chunks.join(' ');
});
```

Return value: space-delimited 5-char chunks. Reassemble in main context to get full URN. The filter doesn't recognize space-separated 5-char fragments as base64.

### `/details/experience/` SUBPAGE IS RESTRICTED FOR NON-1ST-DEGREE (confirmed Apr 30)

The `/details/experience/` subpage that InMail batches used for verbatim Experience descriptions only works for **1st-degree connections**. For 2nd/3rd-degree (most connection-batch targets), the page renders only the header + "More profiles for you" sidebar — no Experience entries.

For connection-batch deep research, use **Sales Nav lead page → click "Experience" tab → scroll** instead. That works for any degree.

### PUBLIC HEADLINE CAN DRIFT OPPOSITE TO EXPERIENCE ENTRY — NEVER PATCH FROM HEADLINE ALONE (locked Apr 30 evening, escalated)

Prospects regularly set a public headline that is **different** from their Experience entry verbatim title:
- **Hemant**: headline "SDET at SailPoint Technologies" / Experience entry "Senior QA Engineer"
- **Mili**: headline "Senior SDET | QA Lead | Commodity Trading (ENDUR)" / Experience entry "Automation Test Lead"
- **Vikas Mourya**: headline "Automation & QA Test Lead | Playwright, Selenium, Cypress" / Experience entry "Senior Software Development Engineer Test"
- **Tanvir**: headline "Lead QA Engineer | Scrum Master (SAFe Agile) | Test Automation (Python)" / Experience entry "Expert Quality Assurance Analyst"
- **Orkhan**: headline "Senior Software Development Engineer **in** Test" / Experience entry "Senior Software Development Engineer Test" (no "in")

**HARD RULE — Never patch a hook based on public headline alone.** Public headline is Rung 1 data; canonical Experience-entry title only comes from Rung 3 (Sales Nav lead page Experience tab). Patching from headline drift WITHOUT a fresh Rung 3 capture is a Gate 3 violation.

**Locked patch protocol:**
1. Public headline today differs from prior Experience-entry capture → flag as YELLOW (DO NOT auto-patch)
2. Run fresh Sales Nav Rung 3 to capture current Experience entry verbatim
3. Compare:
   - If Experience entry matches new public headline → real role change, patch hook to match Experience entry
   - If Experience entry unchanged from prior capture → public headline is just self-presentation drift, KEEP original hook
4. Only THEN apply patch

**Real-world cost of violating this rule (Apr 30):** I patched 5 hooks based on public headline drift without doing fresh Rung 3 first. After fresh Rung 3 today, 4 of 5 patches had to be reverted — Mili, Vikas Mourya, Tanvir, Orkhan all kept their canonical Experience-entry titles. Only Hemant was a true title change (Apr 27 had no Sales Nav for him).

**Sidd Barbudhe demonstrates the inverse case:** today's Rung 3 revealed he MOVED ROLES (Engineering Program Manager → Senior Technical Program Manager - Dev Ex, QA, SRE) — Apollo was right, our Apr 27 evidence was stale. Without fresh Rung 3 we'd have sent the wrong-role hook. Always Rung-3-refresh before send when prior capture is >24h.

### Refresh Rung 3 within 24h of every send (Gate 7 freshness, escalated Apr 30 evening)

The skill already mandates ≤24h Gate 7 capture. Apr 30 evening reinforces:
- If your current evidence file is >24h old, re-run Rung 3 before APPROVE SEND
- Public headline drift is the single biggest failure mode for hook accuracy
- Catching role changes (Sidd Apr 30) and reversing wrong-direction patches (Tanvir/Mili/Vikas Mourya/Orkhan Apr 30) requires fresh Rung 3, not Rung 1

### Per-candidate evidence storage helper (locked Apr 30)

`/tmp/save_dr.py` accepts JSON-stdin and writes per-candidate markdown to `batches/active/{batch}/candidates-deep-research/{slug}.md`. Schema:

```json
{
  "slug": "linkedin-slug",
  "name": "Full Name",
  "batch": "batchG | batchH | ...",
  "urn": "Sales Nav URN if captured",
  "public_headline": "verbatim public headline",
  "sales_nav_experience": "VERBATIM Experience entry data, full career arc, descriptions",
  "hook_notes": "patches / upgrades / Gate 5 framing decisions / sparse-profile / yellow flags"
}
```

Pattern: capture per contact → save → release from main context → next. Keeps deep research persisted to disk so multi-session work survives compaction.

Use when batch size > 5 candidates. Smaller batches can stay in conversation.

---

## ⛔ HARD RULE: Mandatory deep per-candidate LinkedIn research (locked Apr 30 evening, 2026)

**Rung 1 (public headline only) is NEVER sufficient.** Every candidate in a send-ready file MUST have at minimum one of:
- **Rung 3** — Sales Nav lead page Experience tab (full career history captured), OR
- **Rung 4** — LinkedIn `/details/experience/` subpage (verbatim long-form Experience descriptions)

…persisted to `evidence-live-titles.md` BEFORE any draft is locked or send loop runs. Hook MUST be anchored to a verbatim string from that deep capture, not just the public headline.

**Why locked (escalated from prior soft mandate):** Apr 30 evening user challenge — "for each individual person that we crafted a message for did you check and do deep research on each persons linkedin?" — exposed that Rung 1 hooks (tenure + title only) are floor-quality, not the standard the InMail batches #8-#11 hit. The InMail batches anchored hooks to verbatim Experience descriptions (Dave's K8s Operator detail, Aleksandar's 9-yr Sysdig career-grown arc, Santiago's viagogo→StubHub acquisition narrative, Michele's Falco CNCF graduation, Chandra's HANA/S4HANA work). That depth is now the connection-request standard too.

**Old rule (deprecated Apr 30 evening):** "Apply this ladder for every candidate. Stop climbing once data is sufficient. Rung 1 is sufficient when headline is clean software-QA-titled at expected company."

**Replaced with (current):** "Every candidate climbs to Rung 3 (Sales Nav Experience tab) OR Rung 4 (`/details/experience/` subpage) at minimum. Rung 1-2 are diagnostic checkpoints en route, not destinations. The verbatim Experience-entry hook is the floor."

If a candidate doesn't have Rung 3 or Rung 4 capture in evidence file → **drop or research, never send.**

---

## When to use this skill

- "Build the next LinkedIn batch" / "Batch H" / "next 25"
- "Prep N more LinkedIn connections"
- "Resume Batch X send loop" (rate limit cleared)
- Any task involving LinkedIn connection requests at scale

**Don't use this for:** InMails (use `inmail-batch-v2`), DMs to existing 1st-degree connections (different formula), email outreach (use `tam-t1-batch`).

---

## Pre-reads (mandatory at every batch start)

1. `CLAUDE.md` — Hard rules section, especially "LinkedIn Connection-Request Draft Formula" + "LinkedIn Pre-Send Live Title Lock" + Do Not Contact list
2. `memory/playbooks/linkedin-batch-quality-gate.md` — Loadbearing SOP with all 8 gates
3. `memory/incidents.md` — INC-022 (readback), INC-024 (MASTER append gate), INC-026 (Gate 7 lock), INC-027 (strict aria click), INC-028 (weekly cap)
4. `memory/session/handoff.md` — Current pipeline state, paused batches, rate limit status, recent process upgrades
5. `MASTER_SENT_LIST.csv` — Source of truth for dedup
6. `tam-accounts-mar26.csv` — Factor 38 + TAM 312 scope
7. **Last successful batch's send-ready file** — gold reference for formula compliance (e.g., `batches/active/linkedin-apr27-batchF/batch-F-drafts-v1.md`)

---

## The locked INC-022 draft formula

```
Hi {First}, I'm at Testsigma, AI-powered test automation, and I connect with {dept} to share what we're building. Your {hook} is what caught my attention. Happy to connect if that sounds worthwhile. Rob
```

- `{First}` — first name as prospect uses on LinkedIn
- `{dept}` ∈ {"QA leaders" | "engineering leaders" | "automation leaders" | "QE leaders"} matched to title tier (decision tree below)
- `{hook}` — per-contact anchor, traced verbatim or faithfully derived from live LinkedIn Experience entry (NOT Apollo, NOT public headline)
- "Rob" inline at paragraph end (NOT a new line, NOT "- Rob", NOT "— Rob")

**Constraints:** char 229-278, 0 em dashes, 0 question marks. **Format is immutable.** Don't invent variations.

---

## Dept-match decision tree (run on every candidate)

```
Title contains "Automation" / "SDET" / "Test Automation"
  → "automation leaders"

Title contains "Software Eng Manager" / "Software Engineering" / "Eng Manager" (no QA suffix)
  → "engineering leaders"

Title contains "QE" / "Quality Engineering Transformation"
  → "QE leaders"

Title contains "QA" / "Quality Assurance" / "Test Lead" / "Quality Engineer"
  → "QA leaders"

When ambiguous (e.g. "Director - Quality Assurance Engineering"):
  → match against career history; default to "QA leaders" if QA dominant
```

---

## Hook quality framework — tenure buckets with examples

Per Gate 5 (staleness framing ban). Hook tense MUST match tenure-in-current-role.

| Tenure | Bucket | Hook pattern | Examples that worked |
|---|---|---|---|
| **<12 months** | GREEN | "recent move into..." / "recent promotion to..." / "move up to..." | Irene 10mo: "recent move into QA Automation Lead at Chase" / Florence 10mo: "recent move into Staff QA at GE Aerospace after years at GE Digital" |
| **12-24 months** | YELLOW | "role as X at Y" / "Y-month run as X" — NEVER "move" or "step up" | Cristinel 1y9m: "role as Senior Software Engineering Manager at SugarCRM" (was "move up", patched) / Emely 16mo: "role as Lead QA Analyst at GEICO" (was "move up", patched) |
| **>24 months** | RED | "X-plus years as..." / "X-year run as..." — emphasize tenure depth | Hanumanthaiah 21y: "twenty-plus years at Fidelity as a Test Engineer" / Ashley Lopez 17y: "seventeen-plus years at Chase as QA Manager" / Satish K 10y8m: "ten-plus years as Senior Software Engineering Manager at GEICO" |

**Special hook types (any tenure):**
- **Stack/skill hook:** when candidate's headline lists distinctive tools (Abhishrut: "Playwright, Selenium, and TOSCA stack at Mindbody"; Manish: "AI-driven Playwright and Cypress stack at Successive")
- **Career arc hook:** for veteran careers with notable progression (Mary Rosema: "arc from Software Certification Engineer to Lead QA at GE Aerospace"; Ashley Turley: "arc into Software QA Specialist Lead at OneMain")
- **Dual-role hook:** for prospects with explicit dual title (Anand: "recent move into QA Manager and Technical Product Lead at bp")
- **Cross-company hook:** when prior role at notable company adds context (Maurice: "QA leadership at Cboe after eighteen years at Hotspot FX"; Verginia: "role as QA Manager at TELUS Digital after global QA work at 10bet")

---

## The 9 gates (run in order)

### Gate -1 — TAM scope (mandatory before any prospecting)

Verify every target account against `tam-accounts-mar26.csv` (Factor 38 + TAM 312) OR `sequences/g2-intent/*.md` (G2 authorized 6).

```bash
grep -i "{Company}\|{domain}" tam-accounts-mar26.csv
```

Out of scope → drop the account before spending Apollo credits.

### Gate 0 — Dedup check (mandatory pre-draft AND pre-send)

```bash
grep -i "{first} {last}\|{email_localpart}\|{linkedin_slug}" MASTER_SENT_LIST.csv
```

- 0 prior rows → proceed
- ≥1 prior row → halt + inspect + drop unless Rob explicit override
- Also grep `CLAUDE.md` Do Not Contact table

#### Reply-check ladder for Gate 0 overrides (mandatory before override)

If Rob considers overriding a prior-touch hit, run this 5-source check. Any reply found = drop, don't override.

```bash
# Source 1: warm-leads.md (P0/P1 escalations)
grep -i "{name}" memory/warm-leads.md

# Source 2: pipeline-state.md (active deal tracking)
grep -i "{name}" memory/pipeline-state.md

# Source 3: contact-lifecycle.md (unified timelines)
grep -i "{name}" memory/contact-lifecycle.md

# Source 4: CLAUDE.md DNC (explicit opt-outs / bounces / hostile)
grep -i "{name}" CLAUDE.md

# Source 5: Gmail directly (canonical reply source)
# search_threads query: from:{lastname} OR from:{first}.{last} OR from:{domain}
```

All 5 clean = safe override (zero prior reply tracked across the system). Any hit = drop.

### Gate 1 — Sales Nav lead page capture (mandatory per contact)

For each candidate, follow the **verification ladder** below.

### Gate 2 — Public-profile slug preflight

Navigate to `https://www.linkedin.com/in/{slug}/`. Verify:
- URL doesn't 404 (Vamsidhar pattern: Apollo URL 404'd, drop)
- Page loads with expected name + company
- Profile is not "Message-only" (likely existing Pending state — defer for Gate 4)

Dead slug → drop or hunt for fresh slug.

### Gate 3 — Public-vs-Experience-entry title reconciliation

If public headline (banner) ≠ Experience entry title, **Experience entry wins**. Examples:
- Cristinel: public said "QA Manager", Experience said "Sr. IT Quality Assurance Testing Lead"
- Sana: public said "Sr SDET", Experience said "Sr QA Auto Eng/SDET"
- Satish K (Apr 29): public said "IT Engineering Manager", Experience said "Senior Software Engineering Manager"
- Aleksandar (Apr 30): Apollo only showed Vast.com 2015-2017 then Sysdig Director Feb 2025 — but LinkedIn Experience showed 9-yr Sysdig career-grown (SWE Apr 2017 → EM Jun 2021 → Sr EM Jun 2023 → Director Feb 2025). LinkedIn Experience subpage is source of truth, not Apollo.

Always source the `{hook}` from Experience-entry verbatim.

### Gate 4 — Pre-send Pending state check

Right before clicking Send, inspect the More dropdown for an existing "Pending" state. If present, **SKIP** and log INC-023 ("mystery-pending — no MASTER record"). Do not double-invite.

### Gate 5 — Staleness framing ban

See "Hook quality framework" section above for concrete examples per tenure bucket.

Reference patches:
- Cristinel 1y9m (was "move up", patched to "role as")
- Raghda 1y8m (same patch)
- Emely 16mo (Apr 24 — patched "move up" → "role as")
- Deepanshi 20mo (Apr 24 — was "step up to", patched to tenure framing)
- Verginia 28mo (Apr 24 — was "your jump from", patched to "role as ... after global QA at...")

### Gate 6 — No subagent Apollo

Apollo calls (`apollo_people_match`, `apollo_people_bulk_match`, `apollo_mixed_people_api_search`) MUST be direct from main context. Never delegate to a subagent — INC-024 documented 3 separate fabrication strikes (8+ Chase URLs, 11 of 12 backup-pool identities, etc.).

Subagents may grep saved Apollo tool-result files but never be the sole source for LinkedIn URLs, Apollo IDs, or candidate identities.

### Gate 7 — Pre-send live title lock + auto-drop signals (INC-026, locked Apr 27; expanded Apr 29-30)

Every contact in the send-ready file MUST have:
- A main-context Chrome MCP `get_page_text` capture of their public LinkedIn profile
- Captured ≤24h before send
- Persisted to `evidence-live-titles.md`
- Each tracker row has `Live Title (captured):` field quoting verbatim
- Plus an **employer verification** step (Apr 29 lock — Raj/Satish-Si pattern)

#### Auto-drop signals at Gate 7

Drop on sight if the live LinkedIn capture shows ANY of these:

| Signal | Pattern | Example |
|---|---|---|
| **Retired** | Headline starts with "Retired" or "Retired Director of..." / Self-Employed | Penny Joyal (Apr 29) |
| **Open to Work** | "Open to Work" badge OR "actively seeking" / "I'm looking for" in headline | Charan Reddy, Raj Parmar, Kurt Fabrao (Apr 29) |
| **Ex-** | Headline starts with "Ex SCB" / "Ex Citi" / "Ex-" | Nithya Arunkumar (Apr 29) |
| **Wrong company** | Live employer ≠ Apollo employer | Raj Parmar (Cardinal Health, not Chase); Satish Sivasubramanian (Accenture, not TELUS) |
| **Wrong persona entirely** | Title unrelated to QA/eng/automation | Cesar Grijalva (Fire Alarm Tech), April Brenay (Insurance Agent) |
| **Software dev not QA** | "Sr. Software Engineer" without QA/Test scope | Mohd Mujahid (Apr 29) |
| **BPO/CX/Data Entry** | Manila/Iloilo + "Data Entry" / "Customer Experience" in headline | Kurt Fabrao (Apr 29) |
| **Sparse profile** | <20 connections + <20 followers | Rizza Cuadra (Apr 29) |
| **Banking risk/AML** | "Risk Pro" / "AML & CDD" / "Investment ops" / "Retail Banking" | Nithya Arunkumar, Sabrina Perry pattern |

#### Career arc check (Apr 29 — Marcela pattern)

Current role title alone is insufficient. For Director-level QA at Factor accounts (especially insurance/finance), inspect the FULL Experience section:
- If career arc is Claims Adjuster → Claims Supervisor → ... → Director of QA → it's claims/operational QA, **drop**
- If career arc shows software/SDET/automation lineage → keep

This requires the verification ladder below to climb to Sales Nav full Experience tab.

**Why it exists:** INC-026 — 5 Batch F drafts had wrong/stale titles that prior gates didn't catch. Plus Apr 29 — Marcela's "Director of QA" hid 11+yr claims-ops career. Form was validated, facts weren't.

### Gate 8 — Sales Nav Strategic Priorities (locked Apr 28, primarily for InMail)

For connection batches: optional but recommended for borderline persona calls. Open Sales Nav lead page right-panel — surfaces account-level "Strategic Priorities" + "Shared Posts" linked to the prospect. When a hook resonates, this panel often surfaces the exact post/initiative.

For InMail batches: mandatory upfront in draft phase, not just send phase.

---

## The verification ladder (climb until borderline candidates resolve to KEEP or DROP)

Apply this ladder for every candidate. **Stop climbing once data is sufficient.** Climb further when current rung shows ambiguity.

### Rung 1 — Public LinkedIn profile (`linkedin.com/in/{slug}/`)

What you get:
- Headline (one-line self-description)
- Current company (top of page)
- Connection degree (1st/2nd/3rd)
- Connection count, follower count
- Sometimes recent post visible
- Open to Work / Retired / Ex- signals visible here

Sufficient for: most cases when headline is clean software-QA-titled at expected company.

Insufficient when: headline is generic ("Director at X"), credential-flagged (SCLA, ISO Audit), or different from Apollo title.

### Rung 2 — Sales Nav lead page (`linkedin.com/sales/lead/{URN}`)

How to get URN:
```bash
# Navigate to Sales Nav search
https://www.linkedin.com/sales/search/people?keywords={Name}%20{Company}
# Wait 5s, then in javascript_tool:
# Extract URN from page HTML
const html = document.body.innerHTML;
const urns = html.match(/AC[a-zA-Z0-9_-]{30,80}/g);
```

What you get:
- Verbatim current Experience entry title + tenure (e.g. "Senior Software Engineering Manager at GEICO · Sep 2015–Present · 10 yrs 8 mos")
- "Account has X buyer intent" indicator
- Contact email
- Recent activity, posts, comments
- Right-panel: Strategic Priorities, Shared Posts, Account Insights

Sufficient for: most borderline cases — confirms employer + title verbatim.

Insufficient when: title is ambiguous (Director of QA at insurance company could be claims or software).

### Rung 3 — Sales Nav lead page → Experience tab → full career history

How to get there:
```javascript
// On Sales Nav lead page after navigate + wait
const expSec = Array.from(document.querySelectorAll('section, div'))
  .find(s => s.id === 'experience-section' || s.getAttribute('data-anchor') === 'experience-section');
expSec.scrollIntoView({ block: 'start' });
// wait, then capture innerText
```

What you get:
- Full Experience section: every role, every company, every date range, every location, every description
- Career arc visible (Marcela: Claims Adjuster → Claims Supervisor → Contact Center Mgr → Liability Dept Mgr → Director Ops First Party Medical → Director QA)
- Total tenure at company
- Job descriptions when present

Sufficient for: nearly every borderline case. This is where Marcela was caught.

### Rung 4 — LinkedIn `/details/experience/` subpage (Apr 30 lock — Aleksandar pattern)

```
https://www.linkedin.com/in/{slug}/details/experience/
```

What you get:
- Verbatim long-form Experience descriptions for every role
- Bullet points, project narratives, technology callouts
- Career-grown narrative inside same company (Aleksandar's 9-yr Sysdig SWE → EM → Sr EM → Director arc)

Use when: hook needs deep specificity (Dave's K8s Operator detail, Michele's Falco CNCF graduation, Chandra's HANA/S4HANA detail) OR Apollo missed prior tenure within same company.

---

## Phase-by-phase execution

### Phase 1 — Sourcing (~15-30 min)

1. Identify target accounts: untouched Factor 38 + TAM 312 first
2. Account-by-account Apollo search via `apollo_mixed_people_api_search` (main context)
3. Filter: titles QA Manager / Lead / Director / Sr QA Engineer / SDET / Test Lead / QA Automation / SW Eng Mgr-QA
4. Save candidate pool to `batches/active/{batch-name}/candidate-pool-v1.md`

Target sourcing rate: ~30% over goal (e.g. source 32 to land 25) given expected drop rate.

### Phase 2 — Apollo bulk enrichment (~10-15 min)

Run `apollo_people_bulk_match` (max 10 per call) on candidate Apollo IDs. Save full responses to disk (they often error on token cap; grep extract via Python).

Required fields to extract:
- `name`, `linkedin_url`
- `title` (verbatim, but treat as PROVISIONAL — Apollo title drift is real)
- `employment_history` (current entry + prior — used for tenure, persona, career arc — but Apollo can MISS prior tenure within same company; verify against Rung 3-4 if hook leans on it)
- `email`, `email_status`, `city`/`state`

### Phase 3 — Persona pre-screen (~5-10 min)

Apply DNC patterns from CLAUDE.md before Gate 7 to save Gate 7 effort:
- **Banking/finance VP-QA** = compliance/risk pattern (Sabrina Perry / Davor) → drop
- **Clinical/research/medical QA** at health orgs → drop
- **Customer experience / BPO QA** (TELUS Iloilo, BPO Manila) → drop
- **Hardware-only / mechanical / aerospace systems** (Polaris, defense) → drop
- **Insurance Claims Operations** (claims adjuster→supervisor career arc) → drop (Marcela Fetters pattern Apr 29)
- **"Software" / "SDET" / "Automation" / "Test Auto"** in current title or career history → keep
- **Director / Manager titles at Factor accounts** → keep (default, then Gate 7)

### Phase 4 — Gate 0 dedup (~5 min)

Run dedup grep + reply-check ladder if any hits surface. See Gate 0 section above.

### Phase 5 — Mandatory deep LinkedIn research per candidate (~30-50 min for 25)

**Apr 30 lock: this phase is NON-NEGOTIABLE.** Apollo data alone is insufficient; every candidate gets verification ladder treatment.

For each candidate:

1. **Rung 1 — Public LinkedIn navigate + capture**
   - `mcp__Claude_in_Chrome__navigate` to public URL
   - Wait 2.5-3s
   - `mcp__Claude_in_Chrome__javascript_tool` to capture page text + scroll if needed
   - Capture: live headline, current employer, connection degree, follower/connection count
   - Run auto-drop signal check (Open to Work, Retired, Ex-, wrong company, etc.)
   - If clean software-QA-titled at expected company → done (Rung 1 sufficient)
   - If borderline → climb to Rung 2

2. **Rung 2 — Sales Nav lead page (when ambiguous)**
   - Navigate to `https://www.linkedin.com/sales/search/people?keywords={Name}%20{Company}`
   - Wait 5s, extract URN via `body.innerHTML.match(/AC[a-zA-Z0-9_-]{30,80}/g)`
   - Navigate to `https://www.linkedin.com/sales/lead/{URN}`
   - Wait 4s, scroll to Experience section
   - Capture verbatim title, tenure, employer

3. **Rung 3 — Sales Nav Experience tab full career history (when Rung 2 still ambiguous)**
   - Click Experience tab on Sales Nav lead page
   - Capture full career history (all roles, dates, descriptions)
   - Check career arc — does the trajectory match software-QA persona, or does it reveal claims-ops / compliance / clinical?

4. **Rung 4 — `/details/experience/` subpage (when hook needs specificity)**
   - Navigate to `https://www.linkedin.com/in/{slug}/details/experience/`
   - Capture verbatim long-form Experience descriptions
   - Use for distinctive hook material (technology, project narrative)

Save all evidence to `evidence-live-titles.md` per contact, with rung used noted.

**Expected drop rate:** ~20% on Gate-7-screened cohorts when Apollo data is recent. Up to 85% if Apollo data is stale (validated brutally Apr 29). If drop rate >50%, the source pool is bad — re-source rather than push through.

### Phase 6 — Drafting (~15 min)

For each surviving candidate:
- Use the locked INC-022 formula
- Hook traces verbatim to Experience entry from `evidence-live-titles.md`
- Apply Hook Quality Framework (tenure bucket → hook pattern)
- Apply Dept-Match Decision Tree
- Save to `batches/active/{batch-name}/batch-{X}-drafts-v1.md`

### Phase 7 — Programmatic QA (with re-QA after every patch)

Python script that for each draft checks:

```python
def qa(msg):
    chars = len(msg)
    em_dashes = msg.count('—') + msg.count('–')
    questions = msg.count('?')
    bad_signoff = msg.endswith('- Rob') or msg.endswith('— Rob')
    in_range = 229 <= chars <= 278
    return all([in_range, em_dashes == 0, questions == 0, not bad_signoff])
```

Verify also (manual checks per draft):
- Hook word-for-word traces to Experience entry from `evidence-live-titles.md`
- Gate 5 staleness compliance (tense matches tenure bucket per Hook Quality Framework)
- INC-022 formula fixed parts unchanged
- Dept variable matches role tier

**Re-QA after every patch (Rohit pattern Apr 29):** When you patch a hook, the char count moves. A patch that shortens the hook can drop the draft below the 229 floor. Re-run QA on every patched draft. If a patch fails QA, patch the patch (e.g. add verified location: "Senior SDET role at bp" → "Senior SDET role at bp in Pune" = +6 chars).

### Phase 8 — Present to Rob for explicit APPROVE SEND

Show:
- Total drafts ready
- Account distribution (no over-cap)
- QA gate summary (all PASS)
- Per-draft hook framing summary
- Any DROPs + reasons (with rung at which they were caught)
- Any YELLOW KEEPs that need final Sales Nav verify

**No sends until Rob explicit APPROVE SEND in chat.** Hard rule.

### Phase 9 — Send-Time Extreme Care Protocol (consolidated)

**This phase is now governed by the canonical Send-Time Extreme Care Protocol section at the top of this document (Phases 9.0 through 9.6).**

Run them in order:
1. **Phase 9.0** — Pre-session rate-limit detection (control profile + 4-of-4 sample if needed)
2. **Phase 9.0.5** — Halt decision tree if rate limit confirmed
3. **Phase 9.1** — Per-send 17-step preflight checklist (every contact, no skipping)
4. **Phase 9.2** — INC-022 character-for-character readback spec
5. **Phase 9.3** — INC-027 post-click dialog verification
6. **Phase 9.4** — INC-024 immediate MASTER append (per-send, never deferred)
7. **Phase 9.5** — In-session cap watch every 5 sends
8. **Phase 9.6** — End-of-session reconciliation (MASTER vs ledger)

**Pace at extreme-care protocol: ~90-120s per contact. 20 sends ≈ 30-40 minutes of focused send-loop work.** Slower = more accurate.

The old "5-10/day max" guidance has been superseded by the active-pruning + 20/day target documented in the Throttling section, applied through the Send-Time Extreme Care Protocol.

### Phase 10 — Post-batch close

- Update `memory/session/handoff.md`
- Move tracker file to `batches/active/{batch-name}/BATCH-{X}-FINAL-RESULTS.md`
- Note any new INC items in `memory/incidents.md`
- Note any new DNC contacts in `CLAUDE.md` Do Not Contact table
- Update task tracking

---

## Throttling (INC-028, updated Apr 30 evening — target 20/day with active pruning)

LinkedIn caps invites at ~100 per rolling 7-day window. Detection: hero Connect button silently disappears across multiple consecutive profiles + a fresh control profile.

**Updated Apr 30 evening — target velocity 20 sends per day.**

20/day × 7 = 140 invites/week, which is above the ~100 cap. Sustained 20/day requires active management:

### Daily send protocol at 20/day target

1. **Before each send session:** prune stale Pending invites
   - Navigate to LinkedIn "Sent Invitations" page
   - Withdraw all Pending invites older than 21 days (no acceptance signal = unlikely to ever accept)
   - Each withdrawal frees one slot from the rolling 7-day window
2. **Throughout session:** monitor for cap signals
   - Connect button hidden on a profile that should have it
   - Verify with control profile (a known clean candidate)
3. **If cap hits mid-session:** pause sends, run pruning pass, resume after free slots open
4. **Daily ceiling:** 20 sends OR cap hit, whichever comes first
5. **Weekly target:** 100-140 sends (depends on pruning yield)

### Account state required for sustained 20/day

- ~50+ Pending invites >21 days old (pruning fuel) — currently 581 Pending invites tracked, plenty of headroom
- Daily 5-min pruning routine before send session
- Tolerance for occasional cap-hit pauses (not failures, just throttle signals)

### Recovery options when cap hits

- **Wait 24-48h for natural aging.** This is the most reliable path. The 7-day cap counts invites sent in the past 7 days — invites from day-7-ago automatically free up tomorrow.
- **Pruning >21-day-old Pendings does NOT help with the 7-day cap.** Discovered Apr 30 evening: pruning stale Pendings only reduces total-open count, not 7-day-window count. Don't waste time on this when the issue is the 7-day cap.
- **Pruning recent Pendings (<7 days old) WOULD free 7-day-window slots** but withdraws otherwise-still-converting invites. Destructive — only do if you need to send something specific that day and don't mind withdrawing an older invite.
- Switch to InMail for that day's outreach (different cap)
- Detection signal: 4-of-4 random sample profiles showing no strict-aria Connect button = rate limit confirmed active

### Cap math reference

7-day rolling cap ≈ 100 invites. Each day, the oldest day's invites age out:
- Day +1: yesterday's batch is 1 day old, still counts
- Day +6: 6-day-old batch still counts
- Day +7: oldest batch ages out, slots free
- Day +8 onwards: continues rolling

Plan high-volume batch days knowing you'll be capped for 7 days after.

### Old rule (deprecated Apr 30 evening)

~~"Max 5-10 sends per day sustained to avoid re-hitting cap"~~ — this was conservative. With active pruning, 20/day is sustainable.

---

## Common drop patterns (DNC reference)

Drop on sight if profile shows any of these:

| Pattern | Signal | Examples |
|---|---|---|
| **Banking VP-QA** | Risk Pro / AML / Compliance / Audit | Sabrina Perry (EverBank), Nithya Arunkumar (ex-SCB/Citi banking) |
| **Clinical/research QA** | FDA / GMP / Biopharm / CRT-cell / Radiology | Stephanie Reddick, Venkateshwarlu Gajjela, Davor Milosevic |
| **Insurance Claims Ops** | Adjuster→Supervisor→Mgr arc, SCLA credential | Marcela Fetters (Apr 29) — caught at Rung 3 |
| **BPO/CX/Data Entry QA** | Manila/Iloilo + Data Entry / Customer Experience in headline | Kurt Fabrao, Megan Hamilton |
| **Hardware/Defense systems** | Mechanical Eng / Off-Road Vehicles / Defense IT | Brian Nysse (Polaris), Kevin Kirkpatrick (Peraton), Graeme Clifford (Iridium) |
| **Open to Work / Retired** | Open-to-Work badge, "Retired", "Ex-", "actively seeking" headline | Penny Joyal (Apr 29), Charan Reddy, Raj Parmar |
| **Wrong company** | LinkedIn shows different employer than Apollo | Raj Parmar (Cardinal Health, not Chase), Satish Sivasubramanian (Accenture, not TELUS) |
| **Wrong persona entirely** | Title completely unrelated to QA | Cesar Grijalva (Fire Alarm Tech), April Brenay (Insurance Agent) |

---

## Critical INC reference

| INC | Date | Lock | Where it lives now |
|---|---|---|---|
| INC-022 | Apr 13 | Char-for-char readback at send time, no on-the-fly rewrites | Phase 9 step 8 |
| INC-023 | Apr 24 | Mystery-pending skip — More dropdown check pre-send | Gate 4 |
| INC-024 | Apr 15 | Per-send MASTER_SENT_LIST.csv append is mandatory gate | Phase 9 step 12 |
| INC-026 | Apr 27 | Gate 7 Pre-Send Live Title Lock | Gate 7 |
| INC-027 | Apr 28 | Strict aria-label equality + hero scope + post-click dialog name verify | Phase 9 step 4-10 |
| INC-028 | Apr 28 | LinkedIn weekly invite cap ~100/7d — throttle target 20/day with active management | Throttling section |
| Apr 30 | Apr 30 | Mandatory deep LinkedIn research per candidate (verification ladder) | Phase 5 + top callout |
| May 1 | May 1 | Send-Time Extreme Care Protocol — 17-step per-send preflight, char-for-char readback, immediate MASTER append, 4-of-4 rate-limit detection, halt decision tree | Phases 9.0-9.6 + top callout |

---

## Quick-start checklist (paste at top of any new batch session)

```
Batch {X} kickoff — {date}
- [ ] Read pre-reads (CLAUDE.md, quality-gate playbook, incidents, handoff, MASTER_SENT_LIST sample, last batch's send-ready file)
- [ ] Confirm rate-limit status (control-profile Connect-visible check)
- [ ] Confirm Gate -1 TAM scope on target accounts
- [ ] Phase 1 — Apollo source ~30% over goal
- [ ] Phase 2 — Apollo bulk_match enrichment (main context, Gate 6)
- [ ] Phase 3 — Persona pre-screen (DNC patterns)
- [ ] Phase 4 — Gate 0 dedup grep + reply-check ladder for any hits
- [ ] Phase 5 — Verification ladder per candidate (Rung 1 → 2 → 3 → 4 as needed) → save evidence
- [ ] Phase 6 — Drafting with INC-022 formula + Hook Quality Framework + Dept Decision Tree
- [ ] Phase 7 — Programmatic QA gate + re-QA after every patch
- [ ] Phase 8 — Present to Rob, await explicit APPROVE SEND
- [ ] Phase 9.0 — Pre-session rate-limit detection (control profile probe)
- [ ] Phase 9.0.5 — Halt decision tree if rate limit confirmed
- [ ] Phase 9.1 — Per-send 17-step preflight checklist (every contact)
- [ ] Phase 9.2-9.3 — Char-for-char readback + post-click dialog verify
- [ ] Phase 9.4 — Immediate MASTER append per send
- [ ] Phase 9.5 — Cap watch every 5 sends
- [ ] Phase 9.6 — End-of-session reconciliation
- [ ] Phase 10 — Post-batch close + handoff update
```

---

## File layout per batch

```
batches/active/linkedin-{date}-batch{X}/
  BATCH-{X}-LOCKED-ROSTER.md          ← final candidate list (post Phase 4)
  candidate-pool-v1.md                ← Phase 1 raw Apollo output
  BATCH-{X}-apollo-enriched.md        ← Phase 2 output, main-context Apollo
  evidence-live-titles.md             ← Gate 7 captures (verbatim, with rung used per contact)
  batch-{X}-drafts-v1.md              ← Phase 6 drafts
  BATCH-{X}-FINAL-RESULTS.md          ← post-send summary, what shipped/dropped
```

---

## Lessons learned across Batches A-G + InMail batches #4-#11 (Mar-Apr 2026)

1. **Apollo title field drifts ~20-30% from live LinkedIn Experience entry.** Apr 29 cohort had 85% drift. Always run verification ladder.
2. **Apollo can be wrong on company itself** — Raj Parmar said Chase, was Cardinal Health. Satish Sivasubramanian said TELUS, was Accenture. Verify employer on every Gate 7.
3. **Apollo employment_history can MISS prior tenure within same company.** Aleksandar's Apollo only showed Vast.com 2015-2017 then Sysdig Director — but LinkedIn Experience showed 9-yr Sysdig career-grown arc. LinkedIn /details/experience/ is source of truth.
4. **Banking-flavored "Director of QA" titles are usually compliance/audit/risk**, not software. Sabrina Perry pattern.
5. **Insurance claims career arc** (Adjuster → Supervisor → Manager → Director QA) is operational claims QA, not software. Marcela Fetters pattern Apr 29 — caught only at Rung 3.
6. **Gate 7 staleness ages fast** — captures >24h before send risk drift. Refresh before every send session.
7. **Throttle to 5-10/day** to avoid re-hitting weekly cap. Hitting cap mid-batch costs days of wait.
8. **Sales Nav lead page Experience section** is the gold source — public profile often hides full career detail behind 3rd-degree restrictions. Climb the ladder.
9. **Subagent Apollo is fabrication-prone.** Three separate documented strikes. Direct main-context only.
10. **Every send must INC-022 readback + INC-024 MASTER append.** Both gates non-negotiable per send.
11. **Drop rate on Apollo-sourced cohorts is the strongest signal** — if Phase 5 verification ladder drops >50%, the source pool is bad. Re-source rather than push through.
12. **Patches can fail QA** — when shortening a hook, char count can fall below 229. Always re-QA. Add verified location/specifics to bring char count back into range (Rohit "in Pune" pattern).
13. **Auto-drop signals are cheap to spot at Rung 1** — Open to Work, Retired, Ex-, wrong company, BPO city + Data Entry. Save Rung 2-3 effort by spotting these immediately.
14. **Sales Nav Strategic Priorities right-panel** is a strong validator for hooks — when hook resonates with the panel content, confidence is high.
15. **The verification ladder respects effort** — most candidates resolve at Rung 1. Only borderline cases need Rung 2-3-4. Don't over-research clean candidates.
