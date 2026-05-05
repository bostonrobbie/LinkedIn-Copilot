// Pure-function tests for drafting heuristics. No DB, no LLM, no Electron.

import { describe, it, expect } from 'vitest';
import { pickDept, TEMPLATE_HARD_CONSTRAINTS } from '../src/main/agent/drafting';

describe('pickDept — heuristic dept routing', () => {
  it('routes SDET / automation titles to "automation leaders"', () => {
    expect(pickDept('Senior SDET at Acme', null)).toBe('automation leaders');
    expect(pickDept('Test Automation Engineer', 'Lead Automation Engineer')).toBe('automation leaders');
    expect(pickDept(null, 'Automation Lead — Web Platform')).toBe('automation leaders');
  });

  it('routes QE titles to "QE leaders"', () => {
    expect(pickDept('VP Quality Engineering', null)).toBe('QE leaders');
    expect(pickDept(null, 'Director, QE')).toBe('QE leaders');
  });

  it('routes QA titles to "QA leaders"', () => {
    expect(pickDept('QA Manager', null)).toBe('QA leaders');
    expect(pickDept('Quality Assurance Director', null)).toBe('QA leaders');
    expect(pickDept('Senior Test Engineer', null)).toBe('QA leaders');
  });

  it('routes engineering leadership to "engineering leaders"', () => {
    expect(pickDept('VP Engineering at Stripe', null)).toBe('engineering leaders');
    expect(pickDept('Director of Software Engineering', null)).toBe('engineering leaders');
    expect(pickDept('Software Developer', null)).toBe('engineering leaders');
  });

  it('falls back to "QA leaders" when nothing matches', () => {
    expect(pickDept('Marketing Manager', null)).toBe('QA leaders');
    expect(pickDept(null, null)).toBe('QA leaders');
  });
});

describe('TEMPLATE_HARD_CONSTRAINTS', () => {
  it('declares the locked formula constraints', () => {
    expect(TEMPLATE_HARD_CONSTRAINTS.minChars).toBe(229);
    expect(TEMPLATE_HARD_CONSTRAINTS.maxChars).toBe(278);
    expect(TEMPLATE_HARD_CONSTRAINTS.forbiddenChars).toEqual(['—', '?']);
    expect(TEMPLATE_HARD_CONSTRAINTS.requiredPhrases).toContain('AI-powered test automation');
    expect(TEMPLATE_HARD_CONSTRAINTS.requiredPhrases).toContain('Happy to connect if that sounds worthwhile.');
    expect(TEMPLATE_HARD_CONSTRAINTS.signoff).toBe('worthwhile. Rob');
  });
});
