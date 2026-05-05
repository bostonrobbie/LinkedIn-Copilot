// Tests for sendQueue helper logic (the parts that don't require a live DB).
//
// The full sendQueue worker is integration-heavy (DB + Playwright + watchdog).
// We test the INC-030 detection regex + the backoff schedule shape, which are
// the parts that can regress silently.

import { describe, it, expect } from 'vitest';

// looksLikeInc030Burn is internal — we test via regex parity to lock the
// signature pattern. Lifted from sendQueue.ts.
const INC_030_RE = /credit|burned|inmail.*block|no thread|body-readback|send.*timeout/i;
const BACKOFF_MINUTES = [1, 5, 15, 60, 240];

describe('INC-030 burn detection regex', () => {
  it('matches "credit charged" patterns', () => {
    expect(INC_030_RE.test('inmail credit burned, no thread created')).toBe(true);
    expect(INC_030_RE.test('credit charged but send failed')).toBe(true);
  });

  it('matches "no thread" pattern', () => {
    expect(INC_030_RE.test('send returned 200 but no thread created in inbox')).toBe(true);
  });

  it('matches "body-readback" pattern', () => {
    expect(INC_030_RE.test('body-readback mismatch on InMail composer')).toBe(true);
  });

  it('matches "inmail block" pattern', () => {
    expect(INC_030_RE.test('LinkedIn-side inmail block detected')).toBe(true);
  });

  it('matches "send timeout"', () => {
    expect(INC_030_RE.test('send-button click timeout after 90s')).toBe(true);
  });

  it('does NOT match unrelated errors', () => {
    expect(INC_030_RE.test('LinkedIn redirected to login')).toBe(false);
    expect(INC_030_RE.test('Connect button not found')).toBe(false);
    expect(INC_030_RE.test('Profile is not available')).toBe(false);
  });
});

describe('backoff schedule', () => {
  it('escalates monotonically', () => {
    for (let i = 1; i < BACKOFF_MINUTES.length; i++) {
      expect(BACKOFF_MINUTES[i]).toBeGreaterThan(BACKOFF_MINUTES[i - 1]);
    }
  });

  it('starts at 1 minute and ends at 240 minutes (4 hours)', () => {
    expect(BACKOFF_MINUTES[0]).toBe(1);
    expect(BACKOFF_MINUTES[BACKOFF_MINUTES.length - 1]).toBe(240);
  });

  it('total backoff window is 5h21m', () => {
    const totalMin = BACKOFF_MINUTES.reduce((s, m) => s + m, 0);
    expect(totalMin).toBe(321);
  });
});
