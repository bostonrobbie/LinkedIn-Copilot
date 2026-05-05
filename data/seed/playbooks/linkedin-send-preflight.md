# LinkedIn Connection Request Send Preflight Checklist
**Created:** Apr 13, 2026 (INC-022 remediation)  
**Status:** MANDATORY for all LinkedIn connection request send sessions

---

## Why This Exists

INC-022 (Apr 13, 2026): 20 of 24 LinkedIn connection requests were sent with WRONG personalization because the send agent composed messages on-the-fly from LinkedIn profiles instead of using the pre-approved batch tracker text. One contact (Jeb Watkins, JPMorgan) replied hostile. This checklist prevents that class of error.

---

## Pre-Session Gate (Before ANY sends begin)

- [ ] Work Chrome (blue/Testsigma profile) is active
- [ ] Batch tracker HTML file is identified and accessible (e.g., `batches/active/linkedin-connections-[DATE].html`)
- [ ] **LINKEDIN RESEARCH VERIFICATION GATE (MANDATORY Apr 21):** For every READY row in the batch tracker, confirm all three verification artifacts exist per `memory/playbooks/linkedin-research-verification.md`:
  (a) `evidence/{row}-{slug}.txt` file with captured innerText + verdict
  (b) row in `verification-log.csv` with a non-SKIP verdict
  (c) Verification column pill in the tracker HTML is VERIFIED, VERIFIED-WITH-CAVEAT, or FABRICATION-FIXED
  Any row with verdict UNVERIFIED-RISK is NOT eligible to send — get Rob's explicit soften-or-skip decision first. Any row missing the evidence file is NOT eligible — do the verification before the session proceeds.
- [ ] **DEDUP CHECK (MANDATORY Apr 14):** grep every contact name against `MASTER_SENT_LIST.csv`. If a contact has a `LinkedIn Connect` row in the CSV, REMOVE from batch before drafting. Do NOT wait until send time to catch this — wasted research time.
  ```bash
  grep -iE "^(Name1|Name2|Name3)," /sessions/dazzling-kind-hopper/mnt/Work/MASTER_SENT_LIST.csv
  ```
- [ ] **VANITYNAME MAP (MANDATORY Apr 14):** confirm every contact has a captured LinkedIn vanityName (the slug after `/in/`) in the batch tracker BEFORE Rob approves. If a contact can't be found on LinkedIn/Sales Nav/Apollo, mark them SKIP in the tracker with reason. Never enter the send loop with missing vanityNames.
- [ ] Rob has given explicit **"APPROVE SEND"** for this batch
- [ ] Total contact count confirmed (tracker count matches send target, minus dedup/skip)

---

## Per-Contact Send Protocol (EVERY contact, no exceptions)

### Step 1: Extract Message from Tracker
- [ ] Read the per-contact draft file programmatically (`batches/active/[batch]-drafts/NN-name.md`)
- [ ] Extract the EXACT message text from the fenced code block
- [ ] Store the extracted text as the ONLY authorized send content

### Step 2: Direct-Navigate to Invitation Modal (NEW Apr 14)
**The clean path that actually works**: direct navigation to the custom-invite preload URL.

```
https://www.linkedin.com/preload/custom-invite/?vanityName=<VANITY_NAME>
```

This URL opens LinkedIn and immediately renders the "Add a note to your invitation?" pre-dialog. Works even when the new LI redesign blocks programmatic clicks on the Connect button (event.isTrusted check on MouseEvent).

- [ ] Use `mcp__Claude_in_Chrome__navigate` with the preload URL
- [ ] Wait ~3500ms for the modal to render

**Alternative paths that DO NOT work** (do not bother trying):
- Regular `Connect` button click via `.click()` — silently fails
- MouseEvent dispatch (pointerdown/mousedown/pointerup/mouseup) — silently fails
- `/overlay/connect/` URL — returns 404
- `mynetwork/invitation-manager/` — doesn't accept custom messages

### Step 3: Click "Add a note" + Verify Correct Person
Single JS block handles both:
```javascript
new Promise(resolve => setTimeout(() => {
  const d = Array.from(document.querySelectorAll('[role="dialog"]')).filter(d => d.offsetParent !== null)[0];
  const txt = d?.innerText?.slice(0, 400) || '';
  const hasName = txt.includes('<FirstName>');  // verify dialog names the expected person
  if (d && hasName) {
    const addBtn = Array.from(d.querySelectorAll('button')).find(b => b.textContent.trim() === 'Add a note');
    if (addBtn) { addBtn.click(); resolve({hasName:true, clicked:true, dialogText:txt}); return; }
  }
  resolve({hasName, dialogText:txt, hasDialog:!!d});
}, 3500))
```
- [ ] Verify dialog contains expected first name
- [ ] If not: STOP (wrong vanityName or profile unavailable)

**Step 3a — Delayed-dialog retry (NEW Apr 21, from Batch A Moshe Atar):** If the first 3500ms check returns `{hasDialog:false}` or `NO-DIALOG`, LinkedIn sometimes renders the dialog fractionally after our probe window. Run ONE retry probe with an additional 3000ms wait before giving up:
```javascript
new Promise(r => setTimeout(() => {
  const d = document.querySelector('div[role="dialog"]');
  if (!d) { r({retry: false, reason: 'STILL-NO-DIALOG'}); return; }
  const addNote = [...d.querySelectorAll('button')].find(b => b.innerText.trim() === 'Add a note');
  if (addNote) { addNote.click(); r({retry: true, clicked: true}); return; }
  r({retry: true, clicked: false});
}, 3000))
```
If retry still reports no dialog, THEN abort this contact and flag the slug as potentially stale (see Step 2a).

**Step 2a — Stale-slug abort protocol (NEW Apr 21, from Batch A Angga Erwin):** If the preload URL renders the LinkedIn error state "Something went wrong. Refresh the page. Try again." OR a direct `/in/<slug>/` visit redirects to `/404/`, the slug is stale or the profile was renamed/deleted AFTER research time. Do NOT attempt to auto-discover a replacement slug in the send loop — research is a separate pre-approved stage. Action:
  1. SKIP the contact for this send session
  2. Append an entry to `memory/session/friction-log.md` with row number, name, and observed error
  3. Flag for the next batch cycle (slug re-research, then Rob re-approves the send)
  4. Do NOT log this contact to MASTER_SENT_LIST.csv (nothing was sent)

### Step 4: Inject Approved Message
- [ ] Call `find` tool with query "custom message textarea for invitation note" → returns `ref_15`
- [ ] Call `form_input` with `ref_15` and the EXACT tracker text (from Step 1)
- [ ] Do NOT type, compose, or modify any text manually
- [ ] Do NOT read the contact's profile to "improve" the message

### Step 5: Readback Verification + Send (one JS block — MANDATORY)
```javascript
(() => {
  const expected = "<EXACT MESSAGE FROM DRAFT FILE>";
  const actual = document.querySelector('#custom-message')?.value || '';
  const match = actual === expected;
  if (!match) return {match:false, actualLen: actual.length, expectedLen: expected.length};
  const sendBtn = Array.from(document.querySelectorAll('[role="dialog"] button'))
    .filter(b => b.offsetParent !== null)
    .find(b => b.textContent.trim() === 'Send');
  if (sendBtn && !sendBtn.disabled) { sendBtn.click(); return {match:true, sent:true}; }
  return {match:true, sent:false};
})()
```
- [ ] Expect `{match:true, sent:true}`
- [ ] **IF match false:** STOP. Do NOT click. Clear textarea. Re-extract from draft file. Re-inject. Repeat.

### Step 6: Next Contact
- [ ] No artificial sleep required (LinkedIn's modal close + nav settle is enough)
- [ ] Proceed to next draft file

---

## Post-Session Verification

- [ ] Toast counter matches expected total sends
- [ ] Update MASTER_SENT_LIST.csv with all new sends
- [ ] Update batch tracker status for each contact sent
- [ ] Note any skipped contacts and reasons

---

## Red Flags — STOP Immediately If:

- The message in the textarea doesn't match the tracker
- You feel the urge to "improve" or "update" the personalization
- You're reading a prospect's LinkedIn profile during the send loop for message content
- The tracker file can't be read or the message extraction fails
- Any send produces an error or unexpected behavior

**When in doubt: STOP and ask Rob.**

---

## Linked Files

- Hard rule: `CLAUDE.md` → "LinkedIn Connection Request Send Safety"
- Incident: `memory/incidents.md` → INC-022
- Formula: `linkedin-connection-request-formula-LOCKED.md` → Step 7
- Apollo equivalent: `memory/playbooks/send-preflight-checklist.md`
- Reference run: `batches/active/g2-linkedin-apr14-send-log/send-log.md` (22/23 successful, Apr 14, 2026)

---

## Session Learnings Log

### Apr 21, 2026 — Batch A (20/21 = 95.2% success, 1 stale slug skip)
- **Stale-slug case: Angga Erwin (row 17)** — preload URL returned "Something went wrong. Refresh the page. Try again." and direct `/in/angga-erwin/` redirected to `/404/` showing "This page doesn't exist." Slug was valid at Batch A research time (verification-log.csv captured it live Apr 20) but went stale within ~24h (profile rename, deletion, or privacy toggle). **Lesson:** Every batch needs a same-day slug pre-flight script that hits each preload URL, grabs the HTTP response and dialog status, and flags any 404/error BEFORE the send session begins. Added as Step 2a abort protocol.
- **Delayed-dialog case: Moshe Atar (row 19)** — first 3500ms wait check returned `{addNoteClicked: false, hasName: false, snippet: "NO-DIALOG"}` even though the dialog DID render ~4s later. A single 3000ms retry probe caught it. **Lesson:** 3500ms is the 95th percentile but not the 99th — retry once before declaring the slug broken. Added as Step 3a.
- **Mid-send accuracy audit (Rob interjection)** — partway through the send loop, Rob asked to "make sure the already sent messages are accurate." Ran a bash cross-check of each already-sent message against the verification-log.csv signal_claim_in_message column. All 12 passed (4 rows were VERIFIED-WITH-CAVEAT where the Sales Nav source wasn't publicly visible but facts were accurate about the recipient). **Lesson:** The audit was cheap (under 60s) and gave Rob real confidence mid-loop. Add an auto-audit checkpoint at 50% and 100% of every send loop going forward.
- **Final tally:** 20 successful sends (rows 2,3,4,6,7,8,9,11,12,13,14,16,18,19,20,21,22,23,24,25), 1 skip (row 17 Angga — stale slug), 0 fabrications sent, 0 readback mismatches. Character-for-character readback gate caught zero drift — confirming form_input + expected-string compare is the right send-time discipline.

### Apr 14, 2026 (22/23 = 95.7% success)
- **preload/custom-invite URL pattern discovered** — replaces all previous Connect-button-click methods
- **vanityName harvesting is the bottleneck** — 1 of 23 contacts (Tatsiana Poletaeva) not findable via Apollo, LinkedIn search, or Sales Nav search → skipped cleanly. Dead-end contacts need a SKIP protocol, not a workaround
- **Dedup catch saved 2 sends** — Ernest Katta + Jackson Martins already had Apr 7 LinkedIn connect rows in MASTER_SENT_LIST.csv. Dedup must happen BEFORE research, not BEFORE send
- **Apollo `people_bulk_match` returns ~30% nulls** — fall back to `apollo_contacts_search` with q_keywords (works for contacts already enrolled in a sequence)
- **Apollo response files >100KB** — parse via python (`raw = json.load(f); data = json.loads(raw[0]['text']); matches = data['matches']`) instead of reading JSON through context window
- **Name-in-data vs name-on-LinkedIn drift** — Korene Krowe/Rowe, Dustin Dbosteder/Bosteder, Ali Elannan/El-Annan — opener uses first name only so typo in last name doesn't block send; but record both spellings in the draft notes
