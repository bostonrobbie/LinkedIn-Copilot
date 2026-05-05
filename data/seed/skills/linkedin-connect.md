# LinkedIn Connect Skill
**Version:** 1.0 — Created Apr 7, 2026
**Owner:** Rob Gorham, BDR at Testsigma
**Replaces:** Old T3 connection request flow (Day 10 InMail-first model)

---

## Metadata

| Field | Value |
|-------|-------|
| **Trigger** | "start LinkedIn batch", "connection requests today", "send connections", "LinkedIn catch-up", "run LinkedIn connect" |
| **Schedule** | Daily (Mon–Fri) as part of main outreach workflow. Run after morning-briefing. |
| **Output** | Batch HTML tracker with 25 tailored connection notes → APPROVE SEND → sends logged |
| **Tool** | Chrome MCP (blue/work Testsigma profile only) + Apollo MCP (enrichment) |
| **Dependencies** | MASTER_SENT_LIST.csv, memory/playbooks/linkedin-catchup-plan.md, sop-outreach.md (Connection Note Framework), sop-send.md (Day 1 send procedure) |
| **Cross-skill** | Feeds: stage-monitor (acceptance checks), batch-dashboard (pipeline view). Reads: linkedin-catchup-plan.md (priority queue). Updates: MASTER_SENT_LIST.csv, pipeline-state.md, run-log.md |

---

## Purpose

Execute the daily LinkedIn connection request batch. Each run: pull 25 contacts from the priority queue, research each on Sales Navigator, write a tailored 200-250 char connection note, build a batch HTML tracker, present to Rob for APPROVE SEND, then send and log.

**Key principle:** Connection requests are Day 1 of the multi-channel sequence. They cost nothing. If accepted, they unlock a free DM channel for the full message sequence. This skill is the engine for the connection-first LinkedIn strategy.

---

## Safety Rules (ENFORCE BEFORE EVERY ACTION)

1. **Always use blue/work Chrome profile (Testsigma).** If red/personal shows, STOP immediately and alert Rob.
2. **Never send without APPROVE SEND.** Every batch requires Rob's explicit approval before any connection request is sent.
3. **Formula is locked — do not deviate.** The approved note formula names Testsigma and its category but makes no product pitch and asks for no meeting. Acceptance only. See Phase 2.
4. **300 char hard cap on notes (LinkedIn limit).** Always count before sending. Target 220-270 chars.
5. **DNC check mandatory.** Cross-reference every contact against CLAUDE.md DNC list before drafting.
6. **TAM check mandatory.** Every contact's company must be in tam-accounts-mar26.csv or target-accounts.md (Factor).
7. **Composer check (Module A2) mandatory.** Before sending each request, verify no prior InMail thread exists by opening the Sales Nav composer. If a thread exists: STOP, log as "prior contact," skip.
8. **Never send to wrong profile.** If name/title/company doesn't match tracker: STOP, flag, skip.

---

## Execution Phases

### Phase 0: Pre-Run Setup

**0A. Read priority queue**
Open `memory/playbooks/linkedin-catchup-plan.md`. Identify the current active priority phase (P1/P2/P3/P4). Pull the next 25 eligible contacts. If current phase has fewer than 25 remaining, complete it and roll into the next phase.

**0B. DNC pre-filter**
Cross-reference all 25 names against the DNC list in CLAUDE.md. Remove any matches immediately. Replace with the next eligible name from the priority queue. Log removals.

**0C. Dedup check**
Cross-reference all 25 names against MASTER_SENT_LIST.csv. If any name appears with a LinkedIn channel (InMail, DM, Connection): STOP, flag as "already LinkedIn-touched," skip, pull replacement.

---

### Phase 1: Sales Navigator Research (per contact)

For each of the 25 contacts, run this research sequence in Sales Navigator:

**Step 1: Navigate to profile**
Use Chrome MCP: `navigate` to `https://www.linkedin.com/sales/` → search for the contact by name and company.

**Step 2: Open profile panel**
Click on the contact's name to open their full profile panel. Wait for full load.

**Step 3: Extract research signals**
Read and record:
- Current title and company (confirm match with tracker)
- Headline (look for QA-relevant keywords)
- About section (any QA pain language, stack mentions, scale language)
- Current role description (scope of QA responsibility)
- Recent activity (posts, shares — any QA/testing topics)
- Company size and industry (confirm ICP fit)

**Step 4: Select personalization signal**
Tag the strongest research signal using these categories:
- `PLATFORM` — specific product/platform with a clear testing surface (use Type A note)
- `VERTICAL` — vertical-specific testing complexity is clear (use Type B note)
- `SCALING` — QA job postings, team growth, or headcount evidence (use Type C note)
- `TRIGGER` — recent launch, acquisition, migration, compliance event (use Type D note)
- `THIN` — profile is sparse, limited external signal (use Type E note)

**Step 5: Composer check (Module A2)**
Click "Message" on their Sales Navigator profile. If the composer opens a blank "New message" = clean. If an existing thread loads = **PRIOR CONTACT — skip, log, pull replacement.** Close composer without sending anything.

---

### Phase 2: Connection Note Drafting

Use the locked formula below. Do not improvise. Full rationale is in `sop-outreach.md` Connection Note Framework section.

**THE LOCKED FORMULA (Apr 7, 2026):**
```
Hi [First], I'm at Testsigma, AI-powered test automation, and I connect with QA leaders to share what we're building. Your [background/work] at [specific signal] is what caught my attention. Happy to connect if that sounds worthwhile. Rob
```

**Formula rules — every note must follow these exactly:**

1. **Name Testsigma.** Full transparency. "I'm at Testsigma, AI-powered test automation" — always this exact phrasing. Do NOT use product names (Atto, Copilot, etc.) or feature names.
2. **"I connect with QA leaders" — never "I connect with QA leaders in [vertical]".** The vertical-specific framing looks inconsistent with Rob's actual profile (which shows outreach across all verticals). Trust is the goal at first impression. Specificity comes only from the signal line.
3. **Signal line is where personalization lives.** "Your [background/work] at [specific signal] is what caught my attention." The signal must trace to a verified fact from their LinkedIn profile or Apollo enrichment. NEVER fabricate, infer, or assume.
4. **Always end with "Happy to connect if that sounds worthwhile. Rob"** — permission ask, non-pushy, no question mark.
5. **No em dash anywhere.** Use commas.
6. **No question mark anywhere.**
7. **Under 300 characters (LinkedIn hard limit).** Target 220-270. Always count.
8. **No "I noticed" / "I saw" / "I came across."**

**Signal tags still used for research categorization (tracker color-coding only — formula is the same regardless of signal type):**
| Tag | When to use | What changes in the note |
|-----|-------------|--------------------------|
| PLATFORM | Contact works on a named product/platform with clear QA surface | Signal line references the platform by name |
| VERTICAL | Industry-level context is the strongest signal | Signal line references role + company in that vertical |
| SCALING | QA team growth, job postings | Signal line references scale/growth context |
| TRIGGER | Recent launch, acquisition, migration | Signal line references the event |
| THIN | Profile is sparse | Signal line falls back to role + company only |

**QA checklist before logging the note:**
- [ ] Under 300 characters (count manually)
- [ ] "I'm at Testsigma, AI-powered test automation" present — exact phrasing
- [ ] "I connect with QA leaders" — NOT "I connect with QA leaders in [vertical]"
- [ ] Signal line references a specific, verifiable detail from their profile
- [ ] Ends with "Happy to connect if that sounds worthwhile. Rob"
- [ ] No question mark
- [ ] No em dash
- [ ] No product/feature names (Atto, Copilot, etc.)
- [ ] Reads human — not templated or assumptive

---

### Phase 3: Build Batch HTML Tracker

Create a single HTML file: `batches/active/linkedin-connect-[YYYY-MM-DD].html`

**Required fields per contact card:**
- Full name, title, company
- LinkedIn URL (Sales Nav)
- Research signal tag (PLATFORM/VERTICAL/SCALING/TRIGGER/THIN)
- Note type used (A/B/C/D/E)
- Connection note (full text, char count displayed)
- QA checklist results
- Status: `Connection Request Pending`
- Date sent field (blank until sent)
- Acceptance status field (blank until checked Day 3-5)
- Next action field
- Any flags or issues

**Tracker header block:**
```
LINKEDIN CONNECT BATCH — [Date]
Total: [N] contacts | DNC removed: [N] | Prior contact skipped: [N] | Thin profiles: [N]
Priority phase: [P1/P2/P3/P4]
Daily limit: 25 | Weekly limit: 125
```

---

### Phase 4: APPROVE SEND Presentation

Present to Rob with this summary block:

```
LINKEDIN CONNECT BATCH [Date] — Ready for Review

[N] connection notes drafted | [N] DNC removed | [N] prior contact skipped

Priority phase: [P1/P2/P3/P4]
Batch tracker: [link to HTML file]

SAMPLE NOTES (first 3 for formula check):
1. [Name] ([Company]) — Type [A/B/C/D/E], [char count] chars
   "[full note text]"

2. [Name] ([Company]) — Type [A/B/C/D/E], [char count] chars
   "[full note text]"

3. [Name] ([Company]) — Type [A/B/C/D/E], [char count] chars
   "[full note text]"

Reply APPROVE SEND to send all 25, or EDIT [name] with changes.
```

**STOP and wait for Rob's APPROVE SEND.**

---

### Phase 5: Send Execution (After APPROVE SEND)

**⚠️ CRITICAL TECHNICAL PATTERN — Learned Apr 7, 2026 Session 63. Use this exact flow.**

LinkedIn renders all invite modals in shadow DOM. Standard DOM queries and ref-based clicks are unreliable. Use the `preload/custom-invite` URL + shadow DOM `dispatchEvent` pattern for all sends.

**Reliable Send Flow (per contact):**

**Step 1: Navigate directly to preload URL**
```
https://www.linkedin.com/preload/custom-invite/?vanityName=[linkedin-vanity]
```
Wait 4 seconds for modal to load. Verify with:
```javascript
document.body.innerText.includes('Add a note to your invitation?')
```

**Step 2: Click "Add a note" via dispatchEvent (NOT ref click)**
```javascript
function findInShadow(root, selector) {
  const results = [];
  const walk = (node) => {
    if (node.shadowRoot) walk(node.shadowRoot);
    node.querySelectorAll(selector).forEach(el => results.push(el));
    node.querySelectorAll('*').forEach(child => { if (child.shadowRoot) walk(child.shadowRoot); });
  };
  walk(root);
  return results;
}
const buttons = findInShadow(document.body, 'button');
const addNoteBtn = buttons.find(b => b.textContent.trim() === 'Add a note');
addNoteBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
```
Wait 2 seconds. Verify: `findInShadow(document.body, 'textarea').length > 0`

**Step 3: Fill textarea with native setter**
```javascript
const textareas = findInShadow(document.body, 'textarea');
const ta = textareas[0];
const note = "Hi [First], I'm at Testsigma..."; // full approved note
const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set;
setter.call(ta, note);
ta.dispatchEvent(new Event('input', { bubbles: true }));
ta.dispatchEvent(new Event('change', { bubbles: true }));
```
Verify: `ta.value.length === note.length`

**Step 4: Click Send via dispatchEvent**
```javascript
const buttons = findInShadow(document.body, 'button');
const sendBtn = buttons.find(b => b.textContent.trim() === 'Send');
sendBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
```
Wait 2 seconds.

**Step 5: Verify sent**
```javascript
!document.body.innerText.includes('Add a note to your invitation')
```
Should return `true` (dialog gone = invite sent).

**Step 6 (optional spot-check):** Navigate to their profile and open More dropdown. Body should contain "Pending" to confirm invite is queued.

**Batch cadence:** No artificial spacing needed when using the preload URL flow — each navigation is a fresh page load. If LinkedIn shows a rate limit warning: STOP all sends, pause 72 hrs, report to Rob.

**Why not ref-based clicks?** The `find` tool returns ref IDs for shadow DOM elements, but clicking them via `left_click ref=X` sometimes fails to trigger LinkedIn's internal event handlers. `dispatchEvent` with bubbling reliably triggers the framework. Use refs only as a fallback confirmation step, not as the primary click mechanism for shadow DOM buttons.

**"Already Pending" handling:** If the preload URL redirects or the modal never shows "Add a note to your invitation?" — navigate to their standard profile, open More dropdown, check if "Pending" is already listed. If yes, log as "Already Pending" and skip. Do NOT re-send.

---

### Phase 6: Post-Send Logging

After all sends complete:

1. **Update batch tracker:** Mark all sent contacts as "Connection Request Sent [date]"
2. **Update MASTER_SENT_LIST.csv:** Add each contact with channel = "LinkedIn Connection Request"
3. **Update pipeline-state.md:** Log batch under "LinkedIn Connect Wave [date]"
4. **Set Day 3-5 reminder:** Note the acceptance check date in the tracker and in `memory/session/work-queue.md`
5. **Log run:** Append to `run-log.md`:
   ```
   [Date] LinkedIn Connect run: [N] sent, [N] skipped (DNC/prior), [N] thin profiles flagged
   ```

---

### Phase 7: Acceptance Check (Day 3-5)

Run this check 3-5 days after each batch send:

For each "Connection Request Sent" contact in the tracker:
1. Navigate to their LinkedIn profile
2. Check connection status:
   - **"Message" button visible = ACCEPTED.** Update tracker: Acceptance = Accepted [date], Path = DM. Draft DM T1 per `sop-outreach.md` C2 structure. Queue for APPROVE SEND.
   - **"Connect" button still visible = NOT ACCEPTED.** Update tracker: Acceptance = Not Accepted. If Factor or TAM HIGH: flag for InMail T1 (1 credit). If TAM MEDIUM: Path = Email-only. No action needed (email T2 will fire via Apollo).

3. Log acceptance counts in run-log.md and pipeline-state.md.

---

## Error Log (Maintained Per Run)

Append to `memory/session/friction-log.md` after each run:

| Error Type | Description | Resolution |
|-----------|-------------|------------|
| Prior contact found | Composer check revealed existing thread | Skipped, logged, replaced with next contact |
| Profile not found | Sales Nav search returned no results | Logged as "unverifiable," routed to email-only |
| Connection restricted | No "Connect" button available | Logged as "T1 blocked," email-only |
| Wrong profile | Name/title/company mismatch | Stopped, flagged, skipped |
| Char over 250 | Note exceeded limit | Trimmed before sending |
| Chrome wrong profile | Personal profile detected | STOP, alerted Rob |
| LI rate limit warning | "Unusual activity" popup | Stopped all sends, 72hr pause |

---

## Learning Loop Integration

Follow `skills/_shared/learning-loop.md`:

1. **After every run:** Log to `run-log.md` (sends, skips, errors, thin profiles)
2. **After acceptance check:** Log acceptance rate by note type (A/B/C/D/E)
3. **After 5 runs:** Review which note types get highest acceptance rates. Update template bank in `sop-outreach.md` with winning patterns.
4. **Track:** Which research signals (PLATFORM vs VERTICAL vs SCALING etc.) correlate with acceptance. Feed findings back into Connection Note Framework.

---

## Related Skills & Files

| Reference | Purpose |
|-----------|---------|
| `sop-outreach.md` | Connection Note Framework, note types A-E, QA checklist |
| `sop-send.md` | Day 1 send procedure, Day 3-5 DM T1 procedure |
| `memory/playbooks/linkedin-catchup-plan.md` | Priority queue (697 contacts), phase breakdown |
| `memory/playbooks/send-preflight-checklist.md` | Full safety check before any send |
| `MASTER_SENT_LIST.csv` | Dedup source of truth |
| `memory/pipeline-state.md` | Post-send logging destination |
| `skills/stage-monitor/SKILL.md` | Runs acceptance checks in morning briefing |
| `skills/t2-draft-generator/SKILL.md` | Generates DM T1 after acceptance confirmed |

---

## Changelog

| Version | Date | Notes |
|---------|------|-------|
| 1.0 | 2026-04-07 | Initial skill creation. Connection-first model. 25/day, 125/week. Replaces old T3 InMail-first flow. |
| 1.1 | 2026-04-07 | Formula locked after Rob's review. Full Testsigma transparency model adopted. Removed vertical-specific framing from "I connect with" line. Char cap updated to 300 (LinkedIn limit). |
| 1.2 | 2026-04-07 | Phase 5 rewritten with reliable `preload/custom-invite` URL + shadow DOM `dispatchEvent` pattern. Learned from 24-send batch (Session 63). Ref-based clicks unreliable for shadow DOM buttons. "Already Pending" detection documented. |
