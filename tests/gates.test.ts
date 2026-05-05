// Tests for the pure (no-DB) gate functions.

import { describe, it, expect } from 'vitest';
import { degreeCheck, deliverabilityCheck } from '../src/main/agent/gates';

describe('degreeCheck — Phase 0.7', () => {
  it('drops 1st-degree contacts (already connected)', () => {
    const d = degreeCheck('1st');
    expect(d.decision).toBe('drop');
    expect(d.reason).toMatch(/1st-degree/);
  });

  it('passes 2nd-degree', () => {
    expect(degreeCheck('2nd').decision).toBe('pass');
  });

  it('passes 3rd-degree', () => {
    expect(degreeCheck('3rd').decision).toBe('pass');
  });

  it('passes OUT-OF-NETWORK', () => {
    expect(degreeCheck('OUT-OF-NETWORK').decision).toBe('pass');
  });

  it('warns when degree is unknown', () => {
    const d = degreeCheck(null);
    expect(d.decision).toBe('warn');
    expect(d.reason).toMatch(/could not be determined/);
  });
});

describe('deliverabilityCheck — Phase 0.7.5 (INC-030)', () => {
  it('drops near-empty profiles (conn<20 AND followers<20)', () => {
    const d = deliverabilityCheck(5, 10);
    expect(d.decision).toBe('drop');
    expect(d.reason).toMatch(/near-empty|INC-030/);
  });

  it('drops 0/0 profile', () => {
    expect(deliverabilityCheck(0, 0).decision).toBe('drop');
  });

  it('warns at 30/30 (low engagement, send last)', () => {
    const d = deliverabilityCheck(30, 30);
    expect(d.decision).toBe('warn');
  });

  it('warns at conn=40, followers=200 (one side under 50)', () => {
    expect(deliverabilityCheck(40, 200).decision).toBe('warn');
  });

  it('passes at 100/200', () => {
    expect(deliverabilityCheck(100, 200).decision).toBe('pass');
  });

  it('passes at 500/500', () => {
    expect(deliverabilityCheck(500, 500).decision).toBe('pass');
  });

  it('treats null counts as 0 (drops)', () => {
    expect(deliverabilityCheck(null, null).decision).toBe('drop');
  });
});
