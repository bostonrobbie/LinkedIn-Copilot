// Tests for the LinkedIn URL normalization helpers used by the bulk-paste flow.

import { describe, it, expect } from 'vitest';
import { normalizeLinkedInUrl, normalizeBulkUrls } from '../src/shared/url';

describe('normalizeLinkedInUrl', () => {
  it('rejects empty input', () => {
    expect(normalizeLinkedInUrl('')).toEqual(expect.objectContaining({ ok: false }));
    expect(normalizeLinkedInUrl('   ')).toEqual(expect.objectContaining({ ok: false }));
  });

  it('canonicalizes a vanilla profile URL', () => {
    const r = normalizeLinkedInUrl('https://www.linkedin.com/in/john-smith/');
    expect(r.ok).toBe(true);
    expect(r.canonical).toBe('https://www.linkedin.com/in/john-smith/');
    expect(r.slug).toBe('john-smith');
  });

  it('strips trailing query strings + tracking params', () => {
    const r = normalizeLinkedInUrl('https://www.linkedin.com/in/john-smith/?utm_source=email&trk=foo');
    expect(r.canonical).toBe('https://www.linkedin.com/in/john-smith/');
  });

  it('lowercases the slug', () => {
    const r = normalizeLinkedInUrl('https://www.linkedin.com/in/JohnSmith/');
    expect(r.canonical).toBe('https://www.linkedin.com/in/johnsmith/');
  });

  it('strips angle brackets some chat apps add', () => {
    const r = normalizeLinkedInUrl('<https://www.linkedin.com/in/john-smith/>');
    expect(r.ok).toBe(true);
    expect(r.canonical).toBe('https://www.linkedin.com/in/john-smith/');
  });

  it('decodes URL-encoded slugs', () => {
    const r = normalizeLinkedInUrl('https://www.linkedin.com/in/gabija-juod%c5%bebalyt%c4%97-25145457/');
    expect(r.ok).toBe(true);
    expect(r.slug).toMatch(/gabija/);
  });

  it('rejects Sales Nav lead URLs with a clear hint', () => {
    const r = normalizeLinkedInUrl('https://www.linkedin.com/sales/lead/ACoAABCDEFG/');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/Sales Nav/i);
  });

  it('rejects /pub/ legacy URLs with a clear hint', () => {
    const r = normalizeLinkedInUrl('https://www.linkedin.com/pub/firstname-lastname/12/345/678');
    expect(r.ok).toBe(false);
    expect(r.reason).toMatch(/legacy/i);
  });

  it('rejects garbage with a generic reason', () => {
    expect(normalizeLinkedInUrl('not a url').ok).toBe(false);
    expect(normalizeLinkedInUrl('https://example.com').ok).toBe(false);
  });
});

describe('normalizeBulkUrls', () => {
  it('splits newline-separated input + reports counts', () => {
    const r = normalizeBulkUrls(`
      https://www.linkedin.com/in/alice/
      https://www.linkedin.com/in/bob/
      https://www.linkedin.com/in/charlie/
    `);
    expect(r.valid).toHaveLength(3);
    expect(r.invalid).toHaveLength(0);
    expect(r.duplicatesRemoved).toBe(0);
  });

  it('removes duplicates across whitespace + casing', () => {
    const r = normalizeBulkUrls(`
      https://www.linkedin.com/in/john-smith/
      https://www.linkedin.com/in/JOHN-SMITH/
        https://www.linkedin.com/in/john-smith/?ref=feed
    `);
    expect(r.valid).toHaveLength(1);
    expect(r.duplicatesRemoved).toBe(2);
  });

  it('separates invalid lines with reasons', () => {
    const r = normalizeBulkUrls(`
      https://www.linkedin.com/in/alice/
      not a linkedin url
      https://www.linkedin.com/sales/lead/AC123/
      https://www.linkedin.com/pub/old/1/2/3
    `);
    expect(r.valid).toHaveLength(1);
    expect(r.invalid).toHaveLength(3);
    expect(r.invalid.find((i) => /Sales Nav/i.test(i.reason))).toBeDefined();
    expect(r.invalid.find((i) => /legacy/i.test(i.reason))).toBeDefined();
  });

  it('handles a realistic mixed paste', () => {
    const r = normalizeBulkUrls([
      'Hey, here are the prospects:',
      'https://www.linkedin.com/in/alice/',
      '',
      '<https://www.linkedin.com/in/bob/>  ',
      'https://www.linkedin.com/in/CHARLIE/?utm=twitter',
      'https://www.linkedin.com/in/charlie/',  // dup
      'random chatter',
      'https://www.linkedin.com/in/dora/'
    ].join('\n'));
    expect(r.valid).toHaveLength(4); // alice, bob, charlie, dora
    expect(r.duplicatesRemoved).toBe(1);
    expect(r.invalid.length).toBeGreaterThan(0);
  });
});
