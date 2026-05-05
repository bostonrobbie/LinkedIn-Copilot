// Tests for the Phase 1.5b wrong-company detector.

import { describe, it, expect } from 'vitest';
import { wrongCompanyCheck } from '../src/main/agent/gates';

describe('wrongCompanyCheck', () => {
  it('returns null when both inputs match', () => {
    expect(wrongCompanyCheck('Stripe', 'Stripe')).toBeNull();
  });

  it('tolerates corporate suffix differences', () => {
    expect(wrongCompanyCheck('Microsoft Corp', 'Microsoft')).toBeNull();
    expect(wrongCompanyCheck('Acme LLC', 'Acme')).toBeNull();
    expect(wrongCompanyCheck('GlobalCorp Inc', 'GlobalCorp Inc.')).toBeNull();
  });

  it('tolerates substring matches both ways', () => {
    expect(wrongCompanyCheck('SailPoint', 'SailPoint Technologies')).toBeNull();
    expect(wrongCompanyCheck('SailPoint Technologies Holdings', 'SailPoint')).toBeNull();
  });

  it('drops on Apollo vs LinkedIn employer mismatch (Raj Parmar pattern)', () => {
    const r = wrongCompanyCheck('JPMorgan Chase', 'Cardinal Health');
    expect(r?.decision).toBe('drop');
    expect(r?.phase).toBe('1.5');
    expect(r?.reason).toMatch(/wrong-company mismatch/);
  });

  it('drops on Satish Sivasubramanian pattern (TELUS vs Accenture)', () => {
    const r = wrongCompanyCheck('TELUS Digital', 'Accenture');
    expect(r?.decision).toBe('drop');
  });

  it('returns null when either side is null (insufficient data)', () => {
    expect(wrongCompanyCheck(null, 'Anywhere')).toBeNull();
    expect(wrongCompanyCheck('Apollo', null)).toBeNull();
    expect(wrongCompanyCheck(null, null)).toBeNull();
  });

  it('case-insensitive equality', () => {
    expect(wrongCompanyCheck('STRIPE', 'stripe')).toBeNull();
    expect(wrongCompanyCheck('Cardinal Health', 'cardinal health')).toBeNull();
  });
});
