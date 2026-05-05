# ADR 0003 — Anthropic model split: Sonnet for hooks, Opus for QA

**Status:** accepted, May 4, 2026
**Context:** which Claude model handles which agent step

## Decision

- **Sonnet 4.6** drives hook generation and InMail composition.
- **Opus 4.7** drives D2 (evidence traceability) + D3 (specificity) confidence scoring.
- A heuristic fallback handles both when no API key is configured.

## Why split

1. **Hook gen is a lot of calls.** Every prospect that survives gates produces one hook gen call. Sonnet's price + latency is the right level for this throughput.
2. **QA scoring runs once per draft.** The volume is low. Opus's higher reasoning quality matters more than its higher cost — a wrong D2 / D3 score causes a wasted send or a wrongly-dropped prospect.
3. **D1 is deterministic.** Char count, forbidden chars, required phrases — all checked in code, no LLM needed. Wrapping LLM around the parts that benefit from it; keeping deterministic checks deterministic.

## What the LLM is responsible for

- **Sonnet:** generating the `{hook}` substitution from LinkedIn evidence within the locked formula's grammar. Producing a 5-paragraph InMail body.
- **Opus:** judging whether the hook traces verbatim to evidence (D2) and whether it's recipient-specific (D3).

## What the LLM is NOT responsible for

- Choosing whether to send (gates do that).
- Picking the prospect (TAM scope + Apollo dedup do that).
- Editing the locked formula's fixed parts (those are immutable per BDR rules).
- Reading the prospect's profile (Playwright capture does that).

## Fallback

When no API key is set:
- Hook generation falls to a regex-based heuristic on the headline.
- D2 / D3 scoring falls to fixed values (D2=9 if a quote anchor exists, else 7; D3=9 unless hook is too short / generic).
- D1 still runs (deterministic).

The wizard event log surfaces "running on heuristic fallback" so the user knows draft quality will be lower than with a key.

## When to revisit

When Anthropic releases models with better cost/quality on hook-class tasks (e.g., Haiku 5+), reconsider. When we have data on which D2 / D3 scores correlate with replies, we may move D2 / D3 fully into deterministic code.
