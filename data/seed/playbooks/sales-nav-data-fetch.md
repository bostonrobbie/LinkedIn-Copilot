# Sales Nav Data Fetch Protocol — v1.0 (May 4, 2026)

## Why this exists

Skill `inmail-batch-v2` v3.4 mandates Phase 4 full-profile reads (About + full Experience entries + Skills + Education + Featured + Activity). LinkedIn restricts About/Experience/Skills/Education to 1st-degree connections OR via Sales Nav lead-page. Chrome MCP in browser tier-read mode can navigate to URLs but:
- Cannot click into Sales Nav search results to reach lead pages
- Sales Nav slug-based URLs (`linkedin.com/sales/people/<slug>`) don't redirect to lead pages
- Cookie/URN-containing URLs are filtered as tracking data by Chrome MCP

Therefore Rob must fetch Sales Nav lead-page data manually using a JavaScript scraper. This playbook is the protocol.

## When to use

Whenever an InMail batch (or any sales work) requires Phase 4 deep LinkedIn research per candidate. Specifically:
- v3.4 evidence-file required-non-empty fields: `about_section`, `current_role_description`, `prior_role_summary`, `skills_top5`, `education_summary`, `featured_summary`, `recent_activity_full`, `live_headline`, `connection_degree`, `sales_nav_banner_title`
- Any field requiring About / Experience / Skills / Education prose that isn't visible to non-1st-degree contacts
- v3.4 fallback when Chrome MCP scroll-to-bottom doesn't render the required sections

## Protocol — per candidate

### Step 1 — Rob navigates to the Sales Nav lead page
1. Open Sales Navigator in Rob's work Chrome (blue profile)
2. Search for the candidate by name + company
3. Click the result — opens lead page at `linkedin.com/sales/lead/<URN>/...`
4. Wait for the page to fully load (About + Experience sections visible — may need to scroll)

### Step 2 — Rob runs the scraper from DevTools Console
1. Press F12 (or Cmd+Opt+I on Mac) to open DevTools
2. Click the "Console" tab
3. Paste the entire contents of `skills/inmail-batch-v2/sales-nav-fetch.js` (one block)
4. Press Enter
5. The script:
   - Scrolls the page in 8 steps (forces lazy-loaded sections to render)
   - Extracts About, Experience, Skills, Education, Featured, Activity, Recommendations, Strategic Priorities sections
   - Formats as markdown
   - Copies to clipboard
   - Shows alert: `✅ Sales Nav data copied to clipboard (N chars)`

### Step 3 — Rob pastes the markdown into Cowork chat
The pasted block goes directly to me. I parse it, populate the candidate's evidence file at `batches/active/<batch>/evidence-linkedin/<slug>.md`, validate all v3.4 required fields are non-empty, and proceed to Phase 5.

## Output format (what Rob pastes back)

```markdown
# {Name}

**Source:** {URL}
**Captured:** {ISO timestamp}
**Live headline:** {headline}
**Connection degree:** {1st/2nd/3rd}

---

## About
{verbatim About section text}

---

## Experience
{verbatim Experience entries with start/end dates, role descriptions}

---

## Skills
{Skills section content}

---

## Education
{Education entries}

---

## Featured
{Featured posts/content if present}

---

## Recommendations
{Recommendations text}

---

## Recent activity
{90-day activity feed}

---

## Sales Nav Strategic Priorities / Buying Intent
{Sales Nav right-panel insights — buying intent / strategic priorities}

---

## RAW INNERTEXT (fallback for parsing failures)
{first 12,000 chars of full page innerText}
```

## Failure modes + recovery

**Failure 1: Script returns "NOT VISIBLE" for one or more required sections**
- Means the section heading wasn't found by any of the 3 strategies
- The RAW INNERTEXT block at the bottom of the output contains the full page text — orchestrator can parse manually
- If RAW INNERTEXT also doesn't have the section, the page may not have it (e.g., candidate has no Featured posts) — that's a real "NOT VISIBLE", not a script bug

**Failure 2: `alert()` doesn't fire / clipboard not copied**
- Some browsers block `navigator.clipboard.writeText` from console contexts
- Fallback: the markdown is also `console.log`'d — Rob can right-click in console → "Copy message" → paste

**Failure 3: Script throws an error**
- Rob copies the error message + stack trace
- Pastes into Cowork chat
- Orchestrator iterates the script

**Failure 4: Sales Nav page didn't fully load**
- Script's scroll-in-8-steps + 1.2s final wait should cover most cases
- If About/Experience are still missing: Rob waits longer manually + re-runs the script
- Sales Nav has lazy-loading on Experience section beyond the first 2-3 entries — manual scroll inside the section may be needed

## Per-batch Sales Nav fetch list

For each InMail batch, the orchestrator surfaces a list of Sales Nav URLs to Rob:

```
Batch #{N} — Sales Nav fetches needed:
1. {Name 1} / {Company 1} — search Sales Nav, run script, paste back
2. {Name 2} / {Company 2} — same
... (one per candidate)
```

Rob runs the script per candidate, pastes back to chat, orchestrator absorbs each one into the evidence file before moving to Phase 5.

## Why DevTools Console (not bookmarklet)

A bookmarklet would be one-click but has friction:
- Bookmarklets get truncated at ~2000 chars by some browsers; this script is ~5500 chars
- Editing a bookmarklet to iterate the script is harder than editing a `.js` file
- DevTools console paste lets us iterate the script per session without bookmark-bar updates

The DevTools console approach is the simpler, more robust path.

## Skill versioning

This protocol is the v3.5 fulfillment of the v3.4 full-profile-read mandate. Until v3.5 is locked, batches must either:
- Use only 1st-degree candidates (full profile visible without Sales Nav fetch)
- Pause until Sales Nav fetches are completed for all picks

Skill v3.5 lock date: TBD pending first successful test of the scraper on a real Sales Nav lead page.
