# ADR 0004 — Locked draft formulas (immutable templates)

**Status:** accepted, May 4, 2026
**Context:** how to handle the BDR's locked connection-request and InMail templates

## Decision

The connection-request template (INC-022 v1) and Sales Nav InMail 5-paragraph hero formula are **immutable code constants**. The LLM only fills the variable slots (`{First}`, `{dept}`, `{hook}`, etc.). Deterministic D1 scoring enforces every fixed phrase on every draft.

## Why immutable

1. **The BDR repo is the source of truth.** Rob's playbook (`memory/playbooks/linkedin-batch-quality-gate.md`) defines these formulas as locked. The app must not drift.
2. **INC-022 happened because send-time rewriting broke things.** 20 of 24 connection requests were rewritten on the fly with wrong personalization; one prospect replied calling it "AI bot spam." Locking the template + readback at send time is what fixed this.
3. **D1 scoring is the enforcement.** Char count, em dashes, question marks, required phrases ("AI-powered test automation", "Happy to connect if that sounds worthwhile."), sign-off ("worthwhile. Rob") — all enforced deterministically. Sub-10 D1 = the draft is rejected, period.

## How the LLM stays inside the lines

- The system prompt for hook gen says: "single noun phrase, no period, no question mark, 4–12 words, lowercase first letter."
- The output is parsed via zod (`HookSchema`). Schema mismatch → retry once with a stricter prompt → fall back to heuristic.
- Drafting code (`src/main/agent/drafting.ts`) substitutes the hook into the template using simple `.replace()`. The LLM never sees the surrounding formula text.

## Bypass cases

None. There is no admin override. The locked formulas are part of the BDR's voice and the QA gate enforces them universally.

## When to revisit

When Rob's playbook updates (e.g., the v3 InMail formula), the in-code constants are bumped. Both `data/seed/templates/*.md` (the readable copy) and the typescript constants (in `drafting.ts` / `inmail.ts`) move together.
