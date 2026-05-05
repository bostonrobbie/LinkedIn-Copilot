// InMail D1 scoring + heuristic fallback (no LLM).

import { describe, it, expect } from 'vitest';
import { scoreInMailDraft, INMAIL_HARD_CONSTRAINTS } from '../src/main/agent/inmail';
import type { ProfileCapture } from '../src/main/browser/linkedin';
import type { InMailDraft } from '../src/main/agent/inmail';

const dummyCapture: ProfileCapture = {
  url: 'https://www.linkedin.com/in/example/',
  full_name: 'Example Person',
  first_name: 'Example',
  last_name: 'Person',
  headline: 'Director of Engineering',
  location: 'New York',
  connection_degree: '3rd',
  follower_count: 500,
  connection_count: 500,
  about: null,
  current_company: 'Example Corp',
  current_title: 'Director of Engineering',
  recent_activity_text: [],
  raw_text: '',
  experience_subpage: null
};

const goodInMail: InMailDraft = {
  motion: 'sales_nav_inmail',
  subject: 'Two-plus years scaling Example Corp',
  body:
    "Hi Example, I'm at Testsigma, AI-powered test automation. Hopefully its not too much to ask how testing has been holding up at Example Corp, two-plus years in?\n\n" +
    "Reason I'm asking, when a software platform spans web, mobile, API, and integrations, the testing surface tends to multiply fast. UI workflows, API contracts, integration scenarios, all hitting cross-stack at the same time.\n\n" +
    "CRED is one example. As their FinTech app scaled, they got to 90% automated regression coverage with 5x faster execution once AI took over the test authoring and self-healing work their team had been carrying manually.\n\n" +
    "Testsigma's Agent does that across web, mobile, and API. Plain-English test authoring, AI self-healing when locators break, and coverage gaps surfaced automatically as new features ship.\n\n" +
    "Curious if any of that sounds like what your team is running into at Example Corp?\n\nBest,\nRob",
  hook: 'tenure-only',
  hookTier: 'A',
  evidenceQuote: 'tenure-only',
  source: 'heuristic',
  char_count: 0
};
goodInMail.char_count = goodInMail.body.length;

describe('INMAIL_HARD_CONSTRAINTS', () => {
  it('declares the InMail constraints', () => {
    expect(INMAIL_HARD_CONSTRAINTS.bodyMinChars).toBe(700);
    expect(INMAIL_HARD_CONSTRAINTS.bodyMaxChars).toBe(1100);
    expect(INMAIL_HARD_CONSTRAINTS.subjectMinWords).toBe(4);
    expect(INMAIL_HARD_CONSTRAINTS.subjectMaxWords).toBe(10);
    expect(INMAIL_HARD_CONSTRAINTS.forbiddenChars).toEqual(['—']);
    expect(INMAIL_HARD_CONSTRAINTS.requiredPhrases).toContain('AI-powered test automation');
    expect(INMAIL_HARD_CONSTRAINTS.requiredPhrases).toContain('Hopefully its not too much to ask');
  });
});

describe('scoreInMailDraft — D1 deterministic', () => {
  it('a good InMail scores D1=10', () => {
    const r = scoreInMailDraft({ draft: goodInMail, capture: dummyCapture });
    expect(r.d1_formula).toBe(10);
    expect(r.fail_reasons).toEqual([]);
  });

  it('penalizes em dash anywhere', () => {
    const draft = { ...goodInMail, body: goodInMail.body.replace(',', ' —') };
    draft.char_count = draft.body.length;
    const r = scoreInMailDraft({ draft, capture: dummyCapture });
    expect(r.d1_formula).toBeLessThan(10);
  });

  it('penalizes subject under 4 words', () => {
    const draft = { ...goodInMail, subject: 'Hello there' };
    const r = scoreInMailDraft({ draft, capture: dummyCapture });
    expect(r.d1_formula).toBeLessThan(10);
    expect(r.fail_reasons.some((f) => /subject too short/.test(f))).toBe(true);
  });

  it('penalizes subject over 10 words', () => {
    const draft = { ...goodInMail, subject: 'this is a very long subject line with way too many words to fit' };
    const r = scoreInMailDraft({ draft, capture: dummyCapture });
    expect(r.d1_formula).toBeLessThan(10);
    expect(r.fail_reasons.some((f) => /subject too long/.test(f))).toBe(true);
  });

  it('penalizes body under 700 chars', () => {
    const draft = { ...goodInMail, body: 'short body' };
    draft.char_count = draft.body.length;
    const r = scoreInMailDraft({ draft, capture: dummyCapture });
    expect(r.d1_formula).toBeLessThan(10);
  });

  it('penalizes missing "Hopefully its not too much to ask"', () => {
    const draft = { ...goodInMail, body: goodInMail.body.replace('Hopefully its not too much to ask', 'Just wanted to check') };
    draft.char_count = draft.body.length;
    const r = scoreInMailDraft({ draft, capture: dummyCapture });
    expect(r.d1_formula).toBeLessThan(10);
    expect(r.fail_reasons.some((f) => /Hopefully/.test(f))).toBe(true);
  });

  it('penalizes corrected "it\'s" (the lowercase "its" is intentional voice)', () => {
    const draft = { ...goodInMail, body: goodInMail.body.replace("Hopefully its not too much to ask", "Hopefully it's not too much to ask") };
    draft.char_count = draft.body.length;
    const r = scoreInMailDraft({ draft, capture: dummyCapture });
    expect(r.d1_formula).toBeLessThan(10);
  });

  it('penalizes missing sign-off', () => {
    const draft = { ...goodInMail, body: goodInMail.body.replace('Best,\nRob', 'Cheers, Rob') };
    draft.char_count = draft.body.length;
    const r = scoreInMailDraft({ draft, capture: dummyCapture });
    expect(r.d1_formula).toBeLessThan(10);
  });
});
