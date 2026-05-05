// LinkedIn-specific page actions: capture profile, send connection request with INC-022 readback.

import log from 'electron-log';
import { newPage } from './session';
import type { ConnectionDegree } from '@shared/types';

export interface ProfileCapture {
  url: string;
  full_name: string;
  first_name: string;
  last_name: string | null;
  headline: string | null;
  location: string | null;
  connection_degree: ConnectionDegree | null;
  follower_count: number | null;
  connection_count: number | null;
  about: string | null;
  current_company: string | null;
  current_title: string | null;
  recent_activity_text: string[];
  raw_text: string;
  experience_subpage: string | null;  // Rung 4 capture (/details/experience/)
}

const NUM_RE = /([\d,]+)/;

function parseInt0(s: string | null | undefined): number | null {
  if (!s) return null;
  const m = s.match(NUM_RE);
  if (!m) return null;
  return Number(m[1].replace(/,/g, ''));
}

function deriveSlug(url: string): string | null {
  try {
    const u = new URL(url);
    const m = u.pathname.match(/\/in\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  } catch {
    return null;
  }
}

export function buildPublicProfileUrl(input: string): string {
  const slug = deriveSlug(input);
  if (!slug) throw new Error(`Could not derive LinkedIn slug from: ${input}`);
  return `https://www.linkedin.com/in/${slug}/`;
}

export async function capturePublicProfile(userId: number, profileUrl: string): Promise<ProfileCapture> {
  const url = buildPublicProfileUrl(profileUrl);
  const page = await newPage(userId);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await page.waitForTimeout(1500);

  // Bail-out check: redirected to /login or /authwall means session expired.
  const finalUrl = page.url();
  if (/\/login|\/authwall|\/uas\/login/.test(finalUrl)) {
    throw new Error('LinkedIn redirected to login — session expired or not signed in. Re-login via Settings.');
  }

  // Slug preflight — if LinkedIn shows a 404 / "Profile not found" / unavailable
  // page, the saved Apollo URL is stale (Vamsidhar pattern). Surface a clear,
  // actionable error so the orchestrator can drop and the user knows to hunt
  // for a fresh slug.
  const errorPage = await page
    .locator('section.error-section, h1:has-text("Page not found"), h1:has-text("This profile is not available")')
    .first()
    .isVisible({ timeout: 2_000 })
    .catch(() => false);
  if (errorPage) {
    throw new Error(`LinkedIn slug preflight failed — profile at ${url} is 404 / unavailable. Hunt for a fresh slug or drop the candidate.`);
  }

  // Pre-fetch fallback signals up front: <title>, og:tags, structured data.
  const pageTitle = await page.title().catch(() => '');
  const ogTitle = await page.locator('meta[property="og:title"]').first().getAttribute('content').catch(() => null);
  const ogDescription = await page.locator('meta[property="og:description"]').first().getAttribute('content').catch(() => null);

  // Top card — name with multi-selector fallback chain.
  let fullName = (await page
    .locator('h1.text-heading-xlarge, h1[class*="text-heading"]')
    .first()
    .textContent({ timeout: 5_000 })
    .catch(() => null))?.trim() ?? '';
  if (!fullName) {
    fullName = (await page.locator('main h1').first().textContent({ timeout: 2_000 }).catch(() => null))?.trim() ?? '';
  }
  if (!fullName && pageTitle) {
    // LinkedIn page title pattern: "<Name> | LinkedIn" or "<Name> - <Headline> | LinkedIn"
    const m = pageTitle.split(/\s+\|\s+LinkedIn/)[0]?.split(/\s+-\s+/)[0]?.trim();
    if (m) fullName = m;
  }
  if (!fullName && ogTitle) {
    const m = ogTitle.split(/\s+\|\s+LinkedIn/)[0]?.split(/\s+-\s+/)[0]?.trim();
    if (m) fullName = m;
  }

  // Headline — multi-selector + og:description fallback.
  let headline = (await page
    .locator('div.text-body-medium.break-words, div[data-generated-suggestion-target]')
    .first()
    .textContent({ timeout: 3_000 })
    .catch(() => null))?.trim() ?? null;
  if (!headline) {
    headline = (await page.locator('main section:first-of-type div.text-body-medium').first().textContent({ timeout: 2_000 }).catch(() => null))?.trim() ?? null;
  }
  if (!headline && ogDescription) {
    headline = ogDescription.split(/\s+·\s+/)[0]?.trim() ?? null;
  }
  if (!headline && pageTitle.includes(' - ')) {
    const parts = pageTitle.split(' - ');
    if (parts.length > 1) headline = parts[1]?.split(/\s+\|\s+LinkedIn/)[0]?.trim() ?? null;
  }

  let location = (await page
    .locator('span.text-body-small.inline.t-black--light.break-words')
    .first()
    .textContent({ timeout: 3_000 })
    .catch(() => null))?.trim() ?? null;
  if (!location) {
    location = (await page.locator('main section:first-of-type span.text-body-small').first().textContent({ timeout: 2_000 }).catch(() => null))?.trim() ?? null;
  }

  // Connection degree appears as a small badge near the name. We grep the raw page text.
  // Multi-pass fallback chain — LinkedIn frequently shifts the badge markup.
  const rawText = await page.locator('main').first().innerText({ timeout: 5_000 }).catch(() => '');
  let degree: ConnectionDegree | null = null;
  // Pass 1: explicit "Xth degree connection" phrasing.
  if (/\b1st\b/.test(rawText) && /degree connection/i.test(rawText)) degree = '1st';
  else if (/\b2nd\b/.test(rawText) && /degree connection/i.test(rawText)) degree = '2nd';
  else if (/\b3rd\b/.test(rawText) && /degree connection/i.test(rawText)) degree = '3rd';
  // Pass 2: standalone "·" + ordinal badge.
  if (!degree) {
    if (/·\s*1st/i.test(rawText)) degree = '1st';
    else if (/·\s*2nd/i.test(rawText)) degree = '2nd';
    else if (/·\s*3rd/i.test(rawText)) degree = '3rd';
  }
  // Pass 3: dedicated badge container.
  if (!degree) {
    const badge = await page
      .locator('span.dist-value, span[class*="distance-badge"], span[class*="degree"]')
      .first()
      .textContent({ timeout: 2_000 })
      .catch(() => null);
    if (badge) {
      if (/1st/i.test(badge)) degree = '1st';
      else if (/2nd/i.test(badge)) degree = '2nd';
      else if (/3rd/i.test(badge)) degree = '3rd';
    }
  }
  // Pass 4: heuristic via primary action button. "Connect" visible = 2nd/3rd, "Message" + no Connect = likely 1st.
  if (!degree) {
    const hasConnect = await page.locator('main button:has-text("Connect")').first().isVisible({ timeout: 1_500 }).catch(() => false);
    const hasMessage = await page.locator('main button:has-text("Message")').first().isVisible({ timeout: 1_500 }).catch(() => false);
    if (hasMessage && !hasConnect) degree = '1st';
    else if (hasConnect) degree = '3rd'; // safer default — 0.7 gate doesn't drop 3rd
  }

  // Follower / connection counts.
  let connectionCount: number | null = null;
  let followerCount: number | null = null;
  const connMatch = rawText.match(/([\d,]+\+?)\s+connections?/i);
  if (connMatch) connectionCount = connMatch[1].includes('+') ? 500 : parseInt0(connMatch[1]);
  const followMatch = rawText.match(/([\d,]+)\s+followers?/i);
  if (followMatch) followerCount = parseInt0(followMatch[1]);
  // Fallback for counts: dedicated nodes.
  if (connectionCount === null) {
    const cn = await page.locator('a[href*="/connections"], span:has-text("connections")').first().textContent({ timeout: 1_500 }).catch(() => null);
    const m = cn?.match(/([\d,]+\+?)/);
    if (m) connectionCount = m[1].includes('+') ? 500 : parseInt0(m[1]);
  }
  if (followerCount === null) {
    const fn = await page.locator('span:has-text("followers")').first().textContent({ timeout: 1_500 }).catch(() => null);
    const m = fn?.match(/([\d,]+)/);
    if (m) followerCount = parseInt0(m[1]);
  }

  // About section — multi-selector chain.
  let about = (await page
    .locator('section:has(div#about) div.inline-show-more-text, section[aria-labelledby="about"] span[aria-hidden="true"]')
    .first()
    .innerText({ timeout: 3_000 })
    .catch(() => null))?.trim() ?? null;
  if (!about) {
    about = (await page.locator('section[aria-labelledby="about"]').first().innerText({ timeout: 2_000 }).catch(() => null))?.trim() ?? null;
  }

  // Current company + title — multi-selector chain.
  let currentTitle = (await page
    .locator('main section:has(div#experience) li:first-child span[aria-hidden="true"]')
    .first()
    .innerText({ timeout: 3_000 })
    .catch(() => null))?.trim() ?? null;
  if (!currentTitle) {
    // Fallback 1: any first-position experience entry header.
    currentTitle = (await page
      .locator('main section[aria-labelledby="experience"] li:first-of-type span[aria-hidden="true"]')
      .first()
      .innerText({ timeout: 2_000 })
      .catch(() => null))?.trim() ?? null;
  }
  if (!currentTitle && headline) {
    // Fallback 2: derive from headline. "Title at Company" pattern.
    const m = headline.match(/^(.+?)\s+at\s+/i);
    if (m) currentTitle = m[1].trim();
  }

  let currentCompany = (await page
    .locator('main section:has(div#experience) li:first-child a span[aria-hidden="true"]')
    .nth(1)
    .innerText({ timeout: 3_000 })
    .catch(() => null))?.trim() ?? null;
  if (!currentCompany) {
    // Fallback 1: a link in the experience top card pointing to /company/.
    currentCompany = (await page
      .locator('main section:has(div#experience) li:first-child a[href*="/company/"]')
      .first()
      .innerText({ timeout: 2_000 })
      .catch(() => null))?.trim() ?? null;
  }
  if (!currentCompany && headline) {
    // Fallback 2: derive from headline.
    const m = headline.match(/\s+at\s+(.+?)(?:\s*[—|·]|$)/i);
    if (m) currentCompany = m[1].trim();
  }

  // Recent activity texts (best-effort).
  const recent = await page
    .locator('section:has(div#content_collections) li, section[aria-labelledby="content_collections"] li')
    .all()
    .catch(() => []);
  const recentTexts: string[] = [];
  for (const el of recent.slice(0, 5)) {
    const t = (await el.innerText({ timeout: 1_500 }).catch(() => '')).trim();
    if (t) recentTexts.push(t);
  }

  const [first, ...rest] = fullName.split(/\s+/);
  const last = rest.length ? rest.join(' ') : null;

  // Rung 4 — capture /details/experience/ subpage for verbatim long-form
  // Experience descriptions. Per the v7 BDR skill (Apr 30 lock + May 1 confirm),
  // the subpage is RESTRICTED for non-1st-degree connections — the page renders
  // a "this profile is not available" / login wall variant instead of the full
  // experience details. We detect that explicitly and tag the evidence so the
  // QA gate knows whether the capture succeeded.
  let experienceSubpage: string | null = null;
  try {
    const slug = deriveSlug(url);
    if (slug) {
      const subUrl = `https://www.linkedin.com/in/${encodeURIComponent(slug)}/details/experience/`;
      await page.goto(subUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1500);
      const subFinalUrl = page.url();
      // Restricted-page detection: redirected to public profile, login wall, or
      // an error section means the subpage isn't accessible for this prospect.
      const restrictedRedirect = !/\/details\/experience\//.test(subFinalUrl);
      const restrictedError = await page
        .locator('section.error-section, h1:has-text("not available"), h1:has-text("Page not found")')
        .first()
        .isVisible({ timeout: 1_500 })
        .catch(() => false);
      if (restrictedRedirect || restrictedError) {
        log.info(`Rung 4 restricted for ${slug} (non-1st-degree access denied) — using Rung 1 only`);
        experienceSubpage = `RESTRICTED: /details/experience/ not accessible (non-1st-degree). final_url=${subFinalUrl}`;
      } else {
        await page.evaluate(() => window.scrollBy(0, 800)).catch(() => {});
        await page.waitForTimeout(500);
        experienceSubpage = (await page
          .locator('main')
          .first()
          .innerText({ timeout: 5_000 })
          .catch(() => null))?.slice(0, 30_000) ?? null;
      }
    }
  } catch (err) {
    log.warn('Rung 4 capture failed (continuing with Rung 1 only)', err);
  }

  return {
    url,
    full_name: fullName,
    first_name: first || '',
    last_name: last,
    headline,
    location,
    connection_degree: degree,
    follower_count: followerCount,
    connection_count: connectionCount,
    about,
    current_company: currentCompany,
    current_title: currentTitle,
    recent_activity_text: recentTexts,
    raw_text: rawText,
    experience_subpage: experienceSubpage
  };
}

export interface SendConnectionRequestArgs {
  userId: number;
  profileUrl: string;
  approvedMessage: string;     // exact tracker text — must match readback char-for-char
  expectedFullName?: string;   // INC-027: strict aria-label match `Invite {expectedFullName} to connect`
  dryRun?: boolean;
}

export interface SendConnectionRequestResult {
  ok: boolean;
  step: string;
  reason?: string;
  readback?: string;
}

// INC-022 readback: extract → inject → readback → char-for-char compare → send only on match.
export async function sendConnectionRequest(
  args: SendConnectionRequestArgs
): Promise<SendConnectionRequestResult> {
  const { userId, profileUrl, approvedMessage, expectedFullName, dryRun = false } = args;
  const url = buildPublicProfileUrl(profileUrl);
  const page = await newPage(userId);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(1200);

  // Pre-send: check for "Pending" state in More dropdown (Batch C rev-4 / INC-023).
  // If the primary action button reads "Pending" or "Message", skip.
  const primary = await page
    .locator('main button.pvs-profile-actions__action, main div.pv-top-card-v2-ctas button')
    .first()
    .textContent({ timeout: 3_000 })
    .catch(() => null);
  if (primary && /pending/i.test(primary)) {
    return { ok: false, step: 'pre-send-check', reason: 'invitation already pending' };
  }

  // INC-027: strict aria-label equality. We try the strict selector first; only
  // fall back to substring matching if expectedFullName isn't supplied.
  let connectBtn;
  if (expectedFullName) {
    const ariaSelector = `main button[aria-label="Invite ${expectedFullName} to connect"]`;
    connectBtn = page.locator(ariaSelector).first();
    if (!(await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      // Could be in the More dropdown.
      const moreBtn = page.locator('main button:has-text("More")').first();
      if (await moreBtn.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await moreBtn.click();
        await page.waitForTimeout(500);
        connectBtn = page.locator(`div[role="menu"] [aria-label="Invite ${expectedFullName} to connect"]`).first();
      }
    }
    if (!(await connectBtn.isVisible({ timeout: 4_000 }).catch(() => false))) {
      return {
        ok: false,
        step: 'find-connect',
        reason: `INC-027: strict aria-label match for "Invite ${expectedFullName} to connect" failed. Aborting rather than risk wrong-prospect mis-click.`
      };
    }
  } else {
    // Fallback path (no name supplied — older callers).
    connectBtn = page.locator('main button:has-text("Connect")').first();
    if (!(await connectBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      const moreBtn = page.locator('main button:has-text("More")').first();
      if (await moreBtn.isVisible({ timeout: 3_000 }).catch(() => false)) {
        await moreBtn.click();
        await page.waitForTimeout(500);
        connectBtn = page.locator('div[role="menu"] [aria-label*="Connect"], div[role="menu"] button:has-text("Connect")').first();
      }
    }
    if (!(await connectBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
      return { ok: false, step: 'find-connect', reason: 'Connect button not found' };
    }
  }
  await connectBtn.click();
  await page.waitForTimeout(800);

  // INC-027 post-click verify: invitation modal should reference expectedFullName.
  if (expectedFullName) {
    const dialogText = await page.locator('div[role="dialog"]').first().innerText({ timeout: 3_000 }).catch(() => '');
    if (dialogText && !dialogText.includes(expectedFullName)) {
      return {
        ok: false,
        step: 'post-click-verify',
        reason: `INC-027: invitation dialog does not reference "${expectedFullName}". Possible recommendation-card mis-click. Abort.`
      };
    }
  }

  // Click "Add a note".
  const addNote = page.locator('button:has-text("Add a note")').first();
  if (!(await addNote.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return { ok: false, step: 'add-note', reason: '"Add a note" button missing' };
  }
  await addNote.click();
  await page.waitForTimeout(500);

  // Inject the approved message into the textarea.
  const ta = page.locator('textarea[name="message"], textarea#custom-message').first();
  if (!(await ta.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return { ok: false, step: 'find-textarea', reason: 'message textarea missing' };
  }
  await ta.fill(approvedMessage);

  // Readback.
  const readback = (await ta.inputValue({ timeout: 3_000 }).catch(() => '')).normalize('NFC');
  const expected = approvedMessage.normalize('NFC');
  if (readback !== expected) {
    log.error('INC-022 readback mismatch', { expected, readback });
    return { ok: false, step: 'readback', reason: 'readback != approved', readback };
  }

  if (dryRun) {
    return { ok: true, step: 'dry-run', readback };
  }

  // Click "Send invitation" / "Send".
  const sendBtn = page.locator('button:has-text("Send invitation"), button:has-text("Send")').first();
  if (!(await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return { ok: false, step: 'find-send', reason: 'Send button missing', readback };
  }
  await sendBtn.click();
  await page.waitForTimeout(2000);

  return { ok: true, step: 'sent', readback };
}

// Pre-resume control-profile check. Per v7 BDR skill (Phase 9.0):
//   - Sample up to 4 candidate profiles
//   - 0 of N: at least one had Connect → not rate-limited
//   - 4 of 4 absent: rate-limit confirmed (Phase 9.0.5 cooldown fires)
//
// We pass a list of candidate URLs (from the next-up batch). If the list is
// short, we fall back to a known-public profile (Bill Gates) to make sure we
// always sample at least one.
const FALLBACK_PROFILE_URL = 'https://www.linkedin.com/in/williamhgates/';

export interface ControlProfileResult {
  ok: boolean;
  connectButtonVisible: boolean;       // overall: any-of-N visible
  samplesChecked: number;
  samplesWithConnect: number;
  samplesWithFollow: number;
  error?: string;
  url: string;                          // first sampled URL (legacy field)
}

interface SingleProbeResult {
  ok: boolean;
  connectVisible: boolean;
  followVisible: boolean;
  url: string;
  error?: string;
}

async function probeOne(userId: number, url: string): Promise<SingleProbeResult> {
  const page = await newPage(userId);
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
    await page.waitForTimeout(1500);
    const finalUrl = page.url();
    if (/\/login|\/authwall/.test(finalUrl)) {
      return { ok: false, connectVisible: false, followVisible: false, url: finalUrl, error: 'redirected to login — session expired' };
    }
    const connectVisible = await page
      .locator('main button:has-text("Connect"), main [aria-label*="Invite"]')
      .first()
      .isVisible({ timeout: 3_000 })
      .catch(() => false);
    const followVisible = await page
      .locator('main button:has-text("Follow")')
      .first()
      .isVisible({ timeout: 2_000 })
      .catch(() => false);
    return { ok: true, connectVisible, followVisible, url: finalUrl };
  } catch (err) {
    return { ok: false, connectVisible: false, followVisible: false, url, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function controlProfileCheck(
  userId: number,
  candidateUrls: string[] = []
): Promise<ControlProfileResult> {
  // Build the sample: up to 4 candidate URLs from the queue, then the
  // fallback. If candidateUrls is empty, just probe the fallback alone.
  const samples = candidateUrls.slice(0, 4);
  if (samples.length === 0) samples.push(FALLBACK_PROFILE_URL);

  let connectCount = 0;
  let followCount = 0;
  let firstUrl = samples[0];
  let firstError: string | undefined;
  let okCount = 0;

  for (let i = 0; i < samples.length; i++) {
    const result = await probeOne(userId, samples[i]);
    if (i === 0) {
      firstUrl = result.url;
      if (!result.ok && result.error) firstError = result.error;
    }
    if (result.ok) okCount++;
    if (result.connectVisible) connectCount++;
    if (result.followVisible) followCount++;

    // Early exit: if first probe shows Connect, we're not rate-limited.
    if (i === 0 && result.connectVisible) break;
  }

  if (okCount === 0) {
    return {
      ok: false,
      connectButtonVisible: false,
      samplesChecked: samples.length,
      samplesWithConnect: connectCount,
      samplesWithFollow: followCount,
      error: firstError ?? 'control probe could not load any candidate profile',
      url: firstUrl
    };
  }

  // Rate-limit pattern: 0 of N had Connect AND 1+ had Follow visible.
  if (connectCount === 0 && followCount > 0) {
    return {
      ok: true,
      connectButtonVisible: false,
      samplesChecked: samples.length,
      samplesWithConnect: 0,
      samplesWithFollow: followCount,
      error: `Connect button missing across ${samples.length}/${samples.length} probed profile${samples.length === 1 ? '' : 's'} — likely INC-028 weekly cap soft-block. Wait for the rolling window to age out.`,
      url: firstUrl
    };
  }

  return {
    ok: true,
    connectButtonVisible: connectCount > 0,
    samplesChecked: samples.length,
    samplesWithConnect: connectCount,
    samplesWithFollow: followCount,
    url: firstUrl
  };
}

// Sales Navigator InMail send. Lead URL form: linkedin.com/sales/lead/<URN>,*,<X>
// Public profile URL works as a fallback (Sales Nav redirects).
export interface SendInMailArgs {
  userId: number;
  profileUrl: string;
  approvedSubject: string;
  approvedBody: string;
  dryRun?: boolean;
}

export async function sendSalesNavInMail(args: SendInMailArgs): Promise<SendConnectionRequestResult> {
  const { userId, profileUrl, approvedSubject, approvedBody, dryRun = false } = args;
  const slug = (() => {
    const m = profileUrl.match(/\/in\/([^/?#]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  })();
  if (!slug) return { ok: false, step: 'parse-url', reason: 'could not derive slug' };

  const page = await newPage(userId);
  // Sales Nav has its own URL; we navigate via search-by-name to avoid hardcoding URNs.
  const navUrl = `https://www.linkedin.com/sales/search/people?keywords=${encodeURIComponent(slug.replace(/-/g, ' '))}`;
  await page.goto(navUrl, { waitUntil: 'domcontentloaded', timeout: 45_000 });
  await page.waitForTimeout(1500);

  // Click the first result whose link matches our slug.
  const resultLink = page.locator(`a[href*="/sales/lead/"][data-anonymize="person-name"], a[href*="/sales/lead/"]`).first();
  if (!(await resultLink.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return { ok: false, step: 'sales-nav-search', reason: 'no Sales Nav result for ' + slug };
  }
  await resultLink.click();
  await page.waitForTimeout(2000);

  // Click the "Message" button on the lead page.
  const messageBtn = page.locator('button:has-text("Message")').first();
  if (!(await messageBtn.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return { ok: false, step: 'find-message-btn', reason: 'Message button not found on lead page' };
  }
  await messageBtn.click();
  await page.waitForTimeout(800);

  // Subject + body fields.
  const subjectInput = page.locator('input[placeholder="Subject"], input[id*="subject"]').first();
  const bodyArea = page.locator('div[contenteditable="true"][role="textbox"], textarea[name="body"]').first();
  if (!(await subjectInput.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return { ok: false, step: 'find-subject', reason: 'subject input not found' };
  }
  if (!(await bodyArea.isVisible({ timeout: 5_000 }).catch(() => false))) {
    return { ok: false, step: 'find-body', reason: 'body editor not found' };
  }
  await subjectInput.fill(approvedSubject);
  await bodyArea.click();
  await page.keyboard.insertText(approvedBody);

  // Readback both.
  const subjectReadback = (await subjectInput.inputValue({ timeout: 3_000 }).catch(() => '')).normalize('NFC');
  const bodyReadback = ((await bodyArea.innerText({ timeout: 3_000 }).catch(() => '')) ?? '').trim().normalize('NFC');
  if (subjectReadback !== approvedSubject.normalize('NFC')) {
    log.error('InMail subject readback mismatch', { expected: approvedSubject, got: subjectReadback });
    return { ok: false, step: 'subject-readback', reason: 'subject mismatch', readback: subjectReadback };
  }
  if (bodyReadback.replace(/\s+/g, ' ') !== approvedBody.normalize('NFC').replace(/\s+/g, ' ')) {
    log.error('InMail body readback mismatch', { expected: approvedBody, got: bodyReadback });
    return { ok: false, step: 'body-readback', reason: 'body mismatch', readback: bodyReadback };
  }

  if (dryRun) return { ok: true, step: 'dry-run', readback: bodyReadback };

  const sendBtn = page.locator('button:has-text("Send"):not([disabled])').first();
  if (!(await sendBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
    return { ok: false, step: 'find-send', reason: 'Send button missing', readback: bodyReadback };
  }
  await sendBtn.click();
  await page.waitForTimeout(2500);
  return { ok: true, step: 'sent', readback: bodyReadback };
}
