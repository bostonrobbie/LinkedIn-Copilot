// Apollo provider abstraction. The agent uses Phase 3 dedup + person matching
// without caring whether it's hitting the Apollo API or driving the Apollo UI
// via Playwright. Selection is based on user preference + key availability.
//
// Today both providers are scaffolded with TODOs; the concrete wiring is
// Tier 5 work. The abstraction lets us add it without touching gates / orch.

import log from 'electron-log';
import { newPage } from '../browser/session';
import { withWatchdog } from '../browser/watchdog';
import { getDb } from '../db/client';
import { decryptKey } from '../secrets';

export type ApolloMode = 'auto' | 'api' | 'ui' | 'off';

export interface ApolloMatchInput {
  linkedinUrl?: string;
  email?: string;
  name?: string;
  company?: string;
}

export interface ApolloMatchResult {
  ok: boolean;
  source: 'api' | 'ui' | 'none';
  apolloId?: string;
  emailerCampaignIds?: string[];
  inActiveCampaign?: boolean;
  error?: string;
  // Enrichment data — populated by the API provider so the orchestrator can
  // persist into prospects.apollo_company / apollo_title / apollo_employment.
  _apolloCompany?: string;
  _apolloTitle?: string;
  _apolloEmployment?: string;  // JSON-serialized employment_history
}

export interface ApolloProvider {
  readonly source: 'api' | 'ui' | 'none';
  readonly available: boolean;
  match(input: ApolloMatchInput): Promise<ApolloMatchResult>;
}

// API provider — calls Apollo's /v1/people/match endpoint with retry + backoff.
// Populates the local prospects.apollo_company/title/employment columns so the
// wrong-company gate (1.5b) can fire and the auto-prospect-enroll flow can
// rank candidates by recency.
class ApolloApiProvider implements ApolloProvider {
  readonly source = 'api' as const;
  readonly available: boolean;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.available = !!apiKey;
  }

  async match(input: ApolloMatchInput): Promise<ApolloMatchResult> {
    if (!this.apiKey) {
      return { ok: false, source: 'api', error: 'no Apollo API key configured' };
    }
    if (!input.linkedinUrl && !input.email && !input.name) {
      return { ok: false, source: 'api', error: 'apollo:api requires linkedinUrl, email, or name' };
    }

    const body: Record<string, unknown> = {};
    if (input.linkedinUrl) body.linkedin_url = input.linkedinUrl;
    if (input.email) body.email = input.email;
    if (input.name) {
      const [first, ...rest] = input.name.trim().split(/\s+/);
      body.first_name = first;
      if (rest.length) body.last_name = rest.join(' ');
      if (input.company) body.organization_name = input.company;
    }
    body.reveal_personal_emails = false;
    body.reveal_phone_number = false;

    return await this.callWithRetry('apollo:match', async () => {
      const resp = await fetch('https://api.apollo.io/v1/people/match', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey
        },
        body: JSON.stringify(body)
      });
      if (resp.status === 401) {
        return { ok: false, source: 'api' as const, error: 'Apollo 401 — API key invalid or expired' };
      }
      if (resp.status === 429) {
        const e = new Error('Apollo 429 rate limited');
        (e as { status?: number }).status = 429;
        throw e;
      }
      if (resp.status >= 500) {
        const e = new Error(`Apollo ${resp.status}`);
        (e as { status?: number }).status = resp.status;
        throw e;
      }
      if (!resp.ok) {
        return { ok: false, source: 'api' as const, error: `Apollo HTTP ${resp.status}` };
      }
      const data = (await resp.json()) as {
        person?: { id?: string; organization?: { name?: string }; title?: string; employment_history?: unknown[] };
        contact?: { id?: string; emailer_campaign_ids?: string[]; organization?: { name?: string }; title?: string; employment_history?: unknown[] };
      };
      const contact = data.contact ?? data.person;
      if (!contact) {
        return { ok: true, source: 'api' as const, inActiveCampaign: false };
      }
      const apolloId = contact.id;
      const emailerCampaignIds = (data.contact?.emailer_campaign_ids ?? []) as string[];
      const inActive = emailerCampaignIds.length > 0;
      return {
        ok: true,
        source: 'api' as const,
        apolloId,
        emailerCampaignIds,
        inActiveCampaign: inActive,
        // Extra fields the orchestrator can persist into prospects.*.
        ...(contact.organization?.name ? { _apolloCompany: contact.organization.name } : {}),
        ...(contact.title ? { _apolloTitle: contact.title } : {}),
        ...(contact.employment_history ? { _apolloEmployment: JSON.stringify(contact.employment_history) } : {})
      } as ApolloMatchResult;
    });
  }

  // Search Apollo for people matching ICP (used by the auto-prospect-enroll flow).
  async search(args: {
    titles: string[];
    organizationName?: string;
    page?: number;
    perPage?: number;
  }): Promise<{ ok: boolean; people: ApolloPerson[]; error?: string }> {
    if (!this.apiKey) return { ok: false, people: [], error: 'no Apollo API key' };
    const body: Record<string, unknown> = {
      person_titles: args.titles,
      page: args.page ?? 1,
      per_page: Math.min(args.perPage ?? 25, 100)
    };
    if (args.organizationName) body.organization_names = [args.organizationName];
    try {
      const resp = await fetch('https://api.apollo.io/v1/mixed_people/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache',
          'X-Api-Key': this.apiKey
        },
        body: JSON.stringify(body)
      });
      if (!resp.ok) {
        return { ok: false, people: [], error: `Apollo search HTTP ${resp.status}` };
      }
      const data = (await resp.json()) as { people?: ApolloPerson[]; contacts?: ApolloPerson[] };
      const people = data.people ?? data.contacts ?? [];
      return { ok: true, people };
    } catch (err) {
      return { ok: false, people: [], error: err instanceof Error ? err.message : String(err) };
    }
  }

  // Exponential backoff for transient failures (429 / 5xx / network).
  private async callWithRetry<T>(label: string, fn: () => Promise<T>, maxRetries = 4): Promise<T> {
    let attempt = 0;
    while (true) {
      try {
        return await fn();
      } catch (e) {
        const status = (e as { status?: number; message?: string })?.status;
        const transient =
          status === 429 ||
          (status !== undefined && status >= 500) ||
          /ECONNRESET|ETIMEDOUT|EAI_AGAIN|fetch failed/i.test((e as Error)?.message ?? '');
        if (!transient || attempt >= maxRetries) {
          throw e;
        }
        const waitMs = Math.pow(2, attempt) * 1000;
        log.info(`${label} transient (status=${status}) — retry in ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        attempt++;
      }
    }
  }
}

export interface ApolloPerson {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  title: string | null;
  linkedin_url: string | null;
  email?: string;
  organization?: { name?: string };
  employment_history?: Array<{ organization_name?: string; title?: string; current?: boolean; start_date?: string }>;
}

// UI provider — drives the Apollo web app via a separate Playwright tab.
// Search by name+company → click the contact → read their card to detect
// in-campaign status. This is best-effort and Apollo can change selectors;
// we keep the path runnable and log generously when we fall back.
class ApolloUiProvider implements ApolloProvider {
  readonly source = 'ui' as const;
  readonly available = true;
  private userId: number;

  constructor(userId: number) {
    this.userId = userId;
  }

  async match(input: ApolloMatchInput): Promise<ApolloMatchResult> {
    if (!input.linkedinUrl && !input.name) {
      return { ok: false, source: 'ui', error: 'apollo:ui requires linkedinUrl or name' };
    }
    const run = async (): Promise<ApolloMatchResult> => {
      const page = await newPage(this.userId);
      await page.goto('https://app.apollo.io/#/people', { waitUntil: 'domcontentloaded', timeout: 30_000 });
      await page.waitForTimeout(1500);
      const url = page.url();
      if (/auth0|app\.apollo\.io\/auth/.test(url)) {
        return { ok: false, source: 'ui' as const, error: 'apollo:ui session expired — sign in to https://app.apollo.io' };
      }

      const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
      const query = input.linkedinUrl ? input.linkedinUrl : input.name ?? '';
      try {
        await searchInput.fill(query, { timeout: 5_000 });
        await page.keyboard.press('Enter');
        await page.waitForTimeout(2_000);
      } catch (err) {
        log.warn('apollo:ui search input not found', err);
      }

      const body = await page.locator('body').innerText({ timeout: 5_000 }).catch(() => '');
      const inActive = /active in sequence|enrolled|in campaign|emailer/i.test(body);
      return { ok: true, source: 'ui' as const, inActiveCampaign: inActive };
    };

    try {
      return await withWatchdog('apollo-ui-match', 45_000, run);
    } catch (err) {
      log.warn('apollo:ui match failed', err);
      return { ok: false, source: 'ui' as const, error: err instanceof Error ? err.message : String(err) };
    }
  }
}

// No-op provider — used when Apollo is explicitly off.
class NoopApolloProvider implements ApolloProvider {
  readonly source = 'none' as const;
  readonly available = true;
  async match(): Promise<ApolloMatchResult> {
    return { ok: true, source: 'none', inActiveCampaign: false };
  }
}

export interface ApolloModeStatus {
  preference: ApolloMode;
  resolved: 'api' | 'ui' | 'none';
  reason: string;
}

export function getApolloMode(): ApolloModeStatus {
  const conn = getDb();
  const row = conn
    .prepare("SELECT value FROM schema_meta WHERE key = 'apollo_mode'")
    .get() as { value: string } | undefined;
  const preference = ((row?.value as ApolloMode) ?? 'auto') as ApolloMode;

  if (preference === 'off') {
    return { preference, resolved: 'none', reason: 'Apollo disabled in settings' };
  }
  // Detect API key presence.
  const keyRow = conn
    .prepare('SELECT apollo_api_key, apollo_api_key_enc FROM users ORDER BY id LIMIT 1')
    .get() as { apollo_api_key: string | null; apollo_api_key_enc: Buffer | null } | undefined;
  const apiKey = keyRow?.apollo_api_key ?? decryptKey(keyRow?.apollo_api_key_enc);
  if (preference === 'api') {
    if (apiKey) return { preference, resolved: 'api', reason: 'API mode forced + key configured' };
    return { preference, resolved: 'none', reason: 'API mode forced but no key set — Phase 3 dedup falls back to local' };
  }
  if (preference === 'ui') {
    return { preference, resolved: 'ui', reason: 'UI mode forced — driving app.apollo.io via Playwright' };
  }
  // auto
  if (apiKey) return { preference, resolved: 'api', reason: 'API key configured' };
  return { preference, resolved: 'ui', reason: 'No API key — falling back to UI automation' };
}

export function setApolloMode(mode: ApolloMode): void {
  getDb()
    .prepare("INSERT INTO schema_meta (key, value) VALUES ('apollo_mode', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value")
    .run(mode);
}

export function getProvider(userId: number): ApolloProvider {
  const m = getApolloMode();
  if (m.resolved === 'api') {
    const keyRow = getDb()
      .prepare('SELECT apollo_api_key, apollo_api_key_enc FROM users WHERE id = ?')
      .get(userId) as { apollo_api_key: string | null; apollo_api_key_enc: Buffer | null };
    const apiKey = keyRow?.apollo_api_key ?? decryptKey(keyRow?.apollo_api_key_enc) ?? '';
    return new ApolloApiProvider(apiKey);
  }
  if (m.resolved === 'ui') return new ApolloUiProvider(userId);
  return new NoopApolloProvider();
}
