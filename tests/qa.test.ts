// QA D1 deterministic scoring tests. Mocks the LLM module so the pure D1 path is exercised.

import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../src/main/agent/llm', () => ({
  scoreD2D3: vi.fn(async () => ({
    d2_evidence: 9,
    d3_specificity: 9,
    fail_reasons: [],
    source: 'heuristic' as const
  })),
  isAnthropicAvailable: vi.fn(() => false),
  getClient: vi.fn(() => null),
  generateHook: vi.fn(),
  SONNET: 'claude-sonnet-4-6',
  OPUS: 'claude-opus-4-7'
}));

import { scoreDraft } from '../src/main/agent/qa';
import type { Draft } from '../src/shared/types';

const goodConnect: Draft = {
  motion: 'connection_request',
  body:
    "Hi Rami, I'm at Testsigma, AI-powered test automation, and I connect with engineering leaders to share what we're building. Your repost about SailPoint Identity Security Accelerator is what caught my attention. Happy to connect if that sounds worthwhile. Rob",
  hook: 'repost about SailPoint Identity Security Accelerator',
  dept: 'engineering leaders',
  char_count: 0
};
goodConnect.char_count = goodConnect.body.length;

describe('scoreDraft — D1 deterministic scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('a good draft scores D1=10 and passes', async () => {
    const c = await scoreDraft({
      draft: goodConnect,
      evidenceQuote: 'SailPoint Identity Security Accelerator',
      liveHeadline: 'Sr. Director of Engineering at SailPoint',
      hasLiveHeadline: true,
      activityStatus: 'ACTIVE'
    });
    expect(c.d1_formula).toBe(10);
    expect(c.pass).toBe(true);
    expect(c.overall).toBeGreaterThanOrEqual(9.0);
  });

  it('penalizes em dash in body', async () => {
    const draft = { ...goodConnect, body: goodConnect.body.replace(',', ' —'), char_count: 0 };
    draft.char_count = draft.body.length;
    const c = await scoreDraft({
      draft, evidenceQuote: null, liveHeadline: 'x', hasLiveHeadline: true, activityStatus: 'ACTIVE'
    });
    expect(c.d1_formula).toBeLessThan(10);
    expect(c.fail_reasons.some((r) => r.includes('—'))).toBe(true);
  });

  it('penalizes question marks (forbidden in connect-request body)', async () => {
    const draft = { ...goodConnect, body: goodConnect.body + '?', char_count: 0 };
    draft.char_count = draft.body.length;
    const c = await scoreDraft({
      draft, evidenceQuote: null, liveHeadline: 'x', hasLiveHeadline: true, activityStatus: 'ACTIVE'
    });
    expect(c.d1_formula).toBeLessThan(10);
    expect(c.fail_reasons.some((r) => r.includes('?'))).toBe(true);
  });

  it('penalizes missing required phrase', async () => {
    const draft = {
      ...goodConnect,
      body: goodConnect.body.replace('AI-powered test automation', 'fancy testing'),
      char_count: 0
    };
    draft.char_count = draft.body.length;
    const c = await scoreDraft({
      draft, evidenceQuote: null, liveHeadline: 'x', hasLiveHeadline: true, activityStatus: 'ACTIVE'
    });
    expect(c.d1_formula).toBeLessThan(10);
    expect(c.fail_reasons.some((r) => r.includes('AI-powered test automation'))).toBe(true);
  });

  it('penalizes wrong signoff', async () => {
    const draft = { ...goodConnect, body: goodConnect.body.replace('worthwhile. Rob', 'worthwhile. — Rob'), char_count: 0 };
    draft.char_count = draft.body.length;
    const c = await scoreDraft({
      draft, evidenceQuote: null, liveHeadline: 'x', hasLiveHeadline: true, activityStatus: 'ACTIVE'
    });
    expect(c.d1_formula).toBeLessThan(10);
  });

  it('penalizes char_count below 229', async () => {
    const draft = {
      ...goodConnect,
      body: 'Hi Rami, AI-powered test automation. Happy to connect if that sounds worthwhile. Rob',
      char_count: 0
    };
    draft.char_count = draft.body.length;
    const c = await scoreDraft({
      draft, evidenceQuote: null, liveHeadline: 'x', hasLiveHeadline: true, activityStatus: 'ACTIVE'
    });
    expect(c.d1_formula).toBeLessThan(10);
  });

  it('penalizes hook with terminal punctuation', async () => {
    const draft = { ...goodConnect, hook: 'work in QA leadership.' };
    const c = await scoreDraft({
      draft, evidenceQuote: null, liveHeadline: 'x', hasLiveHeadline: true, activityStatus: 'ACTIVE'
    });
    expect(c.d1_formula).toBeLessThan(10);
    expect(c.fail_reasons.some((r) => /noun phrase/.test(r))).toBe(true);
  });

  it('a draft with passing D1 but D2<9 fails the gate', async () => {
    const llm = await import('../src/main/agent/llm');
    vi.mocked(llm.scoreD2D3).mockResolvedValueOnce({
      d2_evidence: 6,
      d3_specificity: 9,
      fail_reasons: ['unverifiable activity claim'],
      source: 'llm'
    });
    const c = await scoreDraft({
      draft: goodConnect, evidenceQuote: null, liveHeadline: 'x', hasLiveHeadline: true, activityStatus: 'LINKEDIN-QUIET'
    });
    expect(c.d1_formula).toBe(10);
    expect(c.pass).toBe(false);
    expect(c.d2_evidence).toBe(6);
  });
});
