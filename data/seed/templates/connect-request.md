---
id: connect-request-locked-v1
motion: linkedin_connection_request
locked_at: 2026-04-13
source: BDR/memory/playbooks/linkedin-batch-quality-gate.md (LOCKED INC-022 DRAFT FORMULA)
---

# LinkedIn Connection Request — Locked Formula

Use this template VERBATIM. Only the variables `{First}`, `{dept}`, and `{hook}` may be substituted.

## Template

Hi {First}, I'm at Testsigma, AI-powered test automation, and I connect with {dept} to share what we're building. Your {hook} is what caught my attention. Happy to connect if that sounds worthwhile. Rob

## Variables

- `{First}` — the prospect's first name as it appears on their LinkedIn profile.
- `{dept}` — exactly one of:
  - `QA leaders`
  - `engineering leaders`
  - `automation leaders`
  - `QE leaders`
  Match to the contact's title tier.
- `{hook}` — the personalization anchor. MUST be traceable verbatim to the prospect's `evidence-linkedin/<slug>.md` `evidence_quote_for_hook` field. Tenure-only is the LINKEDIN-QUIET floor. Never fabricate.

## Hard constraints (the QA gate enforces these)

- Total character count between 229 and 278.
- Zero em dashes.
- Zero question marks.
- "Rob" is inline at the end of the paragraph (NOT a new line, NOT "- Rob", NOT "— Rob").
- The phrase "AI-powered test automation" is verbatim.
- The phrase "Happy to connect if that sounds worthwhile." is verbatim.
- No second sentence inside `{hook}` — keep it a single noun phrase that fits the surrounding sentence grammatically.
