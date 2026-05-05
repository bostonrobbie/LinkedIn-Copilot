// Tests the onboarding step manifest matches what the renderer expects.

import { describe, it, expect } from 'vitest';
import { STEPS } from '../src/main/onboarding';

describe('onboarding step manifest', () => {
  it('declares the expected ordered set of steps', () => {
    expect(STEPS).toEqual([
      'welcome',
      'linkedin',
      'salesnav',
      'anthropic',
      'apollo',
      'tam',
      'demo',
      'done'
    ]);
  });

  it('has unique step ids', () => {
    expect(new Set(STEPS).size).toBe(STEPS.length);
  });

  it('starts with welcome and ends with done', () => {
    expect(STEPS[0]).toBe('welcome');
    expect(STEPS[STEPS.length - 1]).toBe('done');
  });
});
