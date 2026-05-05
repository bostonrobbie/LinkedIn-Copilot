// LinkedIn URL normalization. Bulk paste is the noisy entry path — users will
// paste a mix of profile URLs, Sales Nav URLs, mobile URLs, and ones with
// query strings / tracking params. Normalize all of these to a canonical
// `https://www.linkedin.com/in/<slug>/` form, then de-dup.

export interface NormalizedUrl {
  ok: boolean;
  canonical: string;
  slug?: string;
  reason?: string;
}

const SLUG_RE = /\/in\/([^/?#]+)/i;

export function normalizeLinkedInUrl(input: string): NormalizedUrl {
  if (!input) return { ok: false, canonical: '', reason: 'empty input' };
  const trimmed = input.trim();
  if (!trimmed) return { ok: false, canonical: '', reason: 'empty input' };

  // Strip <angle> brackets (some chat apps add them).
  const stripped = trimmed.replace(/^<+|>+$/g, '');

  // Sales Nav lead URLs convert through their slug equivalent — the user must
  // know the slug for our pipeline; we surface a clear error when they paste
  // a /sales/lead/<URN> URL.
  if (/\/sales\/lead\//.test(stripped)) {
    return {
      ok: false,
      canonical: stripped,
      reason: 'Sales Nav lead URL — paste the public profile URL (linkedin.com/in/<slug>/) instead'
    };
  }

  // Mobile / pub / language-suffixed URLs (e.g. linkedin.com/pub/firstname-lastname/12/345/678,
  // linkedin.com/in/john-smith/?locale=de_DE).
  // We only support /in/<slug> for now — other shapes need conversion that's
  // outside the agent's scope.
  const m = stripped.match(SLUG_RE);
  if (!m) {
    if (/linkedin\.com\/pub\//i.test(stripped)) {
      return { ok: false, canonical: stripped, reason: '/pub/ legacy URL — open in LinkedIn and copy the redirected /in/ URL' };
    }
    return { ok: false, canonical: stripped, reason: 'no /in/<slug> path found' };
  }
  const slug = decodeURIComponent(m[1]).toLowerCase();
  return {
    ok: true,
    canonical: `https://www.linkedin.com/in/${slug}/`,
    slug
  };
}

export interface NormalizedBulkUrls {
  valid: Array<{ canonical: string; slug: string; sourceLine: string }>;
  invalid: Array<{ sourceLine: string; reason: string }>;
  duplicatesRemoved: number;
}

export function normalizeBulkUrls(text: string): NormalizedBulkUrls {
  const lines = text.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const seen = new Set<string>();
  const valid: NormalizedBulkUrls['valid'] = [];
  const invalid: NormalizedBulkUrls['invalid'] = [];
  let dupes = 0;

  for (const line of lines) {
    const r = normalizeLinkedInUrl(line);
    if (!r.ok || !r.slug) {
      invalid.push({ sourceLine: line, reason: r.reason ?? 'parse failed' });
      continue;
    }
    if (seen.has(r.slug)) {
      dupes++;
      continue;
    }
    seen.add(r.slug);
    valid.push({ canonical: r.canonical, slug: r.slug, sourceLine: line });
  }

  return { valid, invalid, duplicatesRemoved: dupes };
}
