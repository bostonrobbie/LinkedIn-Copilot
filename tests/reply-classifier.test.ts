// Tests for the heuristic reply-classifier path.

import { describe, it, expect, vi } from 'vitest';

// Mock the LLM client so the heuristic path is forced.
vi.mock('../src/main/agent/llm', () => ({
  getClient: () => null,
  SONNET: 'claude-sonnet-4-6',
  OPUS: 'claude-opus-4-7',
  isAnthropicAvailable: () => false
}));

import { classifyReply } from '../src/main/agent/replyClassifier';

const base = {
  prospectName: 'Test Person',
  prospectCompany: 'Acme',
  motion: 'connection_request' as const,
  draftBody: 'Hi Test, ...'
};

describe('reply classifier — heuristic', () => {
  it('classifies P0 warm on calendar / book / schedule', async () => {
    expect((await classifyReply({ ...base, replyBody: 'Yes, send me a calendar link.' })).classification).toBe('P0_warm');
    expect((await classifyReply({ ...base, replyBody: 'Happy to grab some time next week.' })).classification).toBe('P0_warm');
    expect((await classifyReply({ ...base, replyBody: 'Sure, let\'s set up a quick chat.' })).classification).toBe('P0_warm');
  });

  it('classifies P4 hostile on spam / unsubscribe / bot', async () => {
    const r1 = await classifyReply({ ...base, replyBody: 'Stop spamming me' });
    expect(r1.classification).toBe('P4_hostile');
    expect(r1.shouldDnc).toBe(true);

    const r2 = await classifyReply({ ...base, replyBody: 'Unsubscribe.' });
    expect(r2.shouldDnc).toBe(true);

    const r3 = await classifyReply({ ...base, replyBody: 'This is AI bot spam' });
    expect(r3.classification).toBe('P4_hostile');
  });

  it('classifies P3 auto-reply on OOO patterns', async () => {
    expect((await classifyReply({ ...base, replyBody: 'I am out of the office until Monday.' })).classification).toBe('P3_auto_reply');
    expect((await classifyReply({ ...base, replyBody: 'Automatic reply: I am on parental leave.' })).classification).toBe('P3_auto_reply');
  });

  it('classifies P2 decline on polite no', async () => {
    expect((await classifyReply({ ...base, replyBody: 'Thanks but not interested right now.' })).classification).toBe('P2_decline');
    expect((await classifyReply({ ...base, replyBody: 'Appreciate the reach-out but we\'re good.' })).classification).toBe('P2_decline');
    expect((await classifyReply({ ...base, replyBody: 'We already use a competitor.' })).classification).toBe('P2_decline');
  });

  it('falls back to P1 engaged when no strong keyword fires', async () => {
    expect((await classifyReply({ ...base, replyBody: 'How does it compare to Selenium for our stack?' })).classification).toBe('P1_engaged');
    expect((await classifyReply({ ...base, replyBody: 'Send me your one-pager.' })).classification).toBe('P1_engaged');
  });

  it('only sets shouldDnc on hostile / unsubscribe', async () => {
    const r0 = await classifyReply({ ...base, replyBody: 'Sounds great, let\'s talk.' });
    expect(r0.shouldDnc).toBe(false);

    const r2 = await classifyReply({ ...base, replyBody: 'No thanks.' });
    expect(r2.shouldDnc).toBe(false);

    const r3 = await classifyReply({ ...base, replyBody: 'Out of office.' });
    expect(r3.shouldDnc).toBe(false);

    const r4 = await classifyReply({ ...base, replyBody: 'Stop messaging me, this is harassment.' });
    expect(r4.shouldDnc).toBe(true);
  });
});
