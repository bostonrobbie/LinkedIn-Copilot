// Auto-prospect-enroll. Given a TAM account, find ICP-matching candidates via
// the Apollo provider, then return them ranked. The wizard's bulk-runner can
// pipe these directly into the existing single-prospect orchestrator.

import log from 'electron-log';
import { getDb } from '../db/client';
import { getProvider, type ApolloPerson } from './apollo';

export const DEFAULT_ICP_TITLES = [
  'QA Manager',
  'QA Lead',
  'QA Director',
  'Director of Quality',
  'VP of Quality',
  'Senior SDET',
  'SDET',
  'Test Automation Lead',
  'QA Automation Lead',
  'Quality Engineering',
  'Software Engineering Manager',
  'Senior Software Engineering Manager',
  'Director of Engineering'
];

export interface ProspectCandidate {
  apolloId: string;
  name: string;
  firstName: string;
  lastName: string;
  title: string | null;
  company: string | null;
  linkedinUrl: string | null;
  email?: string;
  // Pre-screen verdict — runs cheap local checks before the user enrolls.
  preScreen: {
    pass: boolean;
    reasons: string[];
  };
}

export interface SourceFromAccountResult {
  ok: boolean;
  candidates: ProspectCandidate[];
  account: { id: number; name: string; tier: string };
  total: number;
  error?: string;
}

const norm = (s: string) => s.trim().toLowerCase();

// Cheap local pre-screen. Filters out names already in DNC, prior-contacts,
// or our own recent outreach. Same checks as Phase 0.5 / 0.6 but applied
// upfront so the candidate list is clean before drafting starts.
function preScreen(userId: number, person: ApolloPerson): { pass: boolean; reasons: string[] } {
  const conn = getDb();
  const reasons: string[] = [];
  const fullName = person.name ?? `${person.first_name} ${person.last_name}`.trim();
  const nameNorm = norm(fullName);

  // DNC.
  const dncHit = conn
    .prepare('SELECT reason FROM dnc WHERE user_id = ? AND name_norm = ?')
    .get(userId, nameNorm) as { reason: string | null } | undefined;
  if (dncHit) reasons.push(`DNC: ${dncHit.reason ?? 'no reason'}`);

  // Prior-contact ledger.
  const masterHit = conn
    .prepare('SELECT channel, send_date FROM prior_contacts WHERE user_id = ? AND name_norm = ? LIMIT 1')
    .get(userId, nameNorm) as { channel: string; send_date: string } | undefined;
  if (masterHit) reasons.push(`master_sent_list ${masterHit.send_date} via ${masterHit.channel}`);

  // App outreach.
  if (person.linkedin_url) {
    const ourHit = conn
      .prepare(
        `SELECT o.status, o.drafted_at FROM outreach o JOIN prospects p ON p.id = o.prospect_id
         WHERE o.user_id = ? AND p.linkedin_url = ?
           AND o.status IN ('sent','accepted','replied','declined','queued','draft')
         ORDER BY o.drafted_at DESC LIMIT 1`
      )
      .get(userId, person.linkedin_url) as { status: string; drafted_at: string } | undefined;
    if (ourHit) reasons.push(`app outreach ${ourHit.drafted_at} status=${ourHit.status}`);
  }

  return { pass: reasons.length === 0, reasons };
}

export async function sourceFromAccount(args: {
  userId: number;
  accountId: number;
  titles?: string[];
  perPage?: number;
}): Promise<SourceFromAccountResult> {
  const conn = getDb();
  const account = conn
    .prepare('SELECT id, name, tier FROM accounts WHERE id = ? AND user_id = ?')
    .get(args.accountId, args.userId) as { id: number; name: string; tier: string } | undefined;
  if (!account) {
    return {
      ok: false,
      candidates: [],
      account: { id: args.accountId, name: '', tier: 'Other' },
      total: 0,
      error: 'account not found'
    };
  }

  const provider = getProvider(args.userId);
  // The UI provider doesn't expose a search method; only the API provider does.
  // For UI mode, return a clear message so the caller knows to ask for an API key.
  if (provider.source !== 'api') {
    return {
      ok: false,
      candidates: [],
      account,
      total: 0,
      error: `Apollo provider is "${provider.source}" — sourcing requires an Apollo API key. Switch to API mode in Settings.`
    };
  }

  // We narrowed source==='api' so the provider is the API one. Cast to access search().
  const apiProvider = provider as unknown as { search: (a: { titles: string[]; organizationName?: string; perPage?: number }) => Promise<{ ok: boolean; people: ApolloPerson[]; error?: string }> };
  const titles = args.titles ?? DEFAULT_ICP_TITLES;
  const search = await apiProvider.search({
    titles,
    organizationName: account.name,
    perPage: args.perPage ?? 25
  });
  if (!search.ok) {
    return { ok: false, candidates: [], account, total: 0, error: search.error };
  }

  const candidates: ProspectCandidate[] = search.people.map((p) => ({
    apolloId: p.id,
    name: p.name ?? `${p.first_name} ${p.last_name}`.trim(),
    firstName: p.first_name,
    lastName: p.last_name,
    title: p.title,
    company: p.organization?.name ?? account.name,
    linkedinUrl: p.linkedin_url,
    email: p.email,
    preScreen: preScreen(args.userId, p)
  }));

  log.info(`autoProspect: sourced ${candidates.length} from ${account.name}; ${candidates.filter((c) => c.preScreen.pass).length} pre-screen clean`);

  return { ok: true, candidates, account, total: candidates.length };
}
