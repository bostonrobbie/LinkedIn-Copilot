// Gate functions. Each returns a GateDecision; orchestrator persists to gate_log.
// Phase numbers map to BDR/memory/playbooks/inmail-batch-process-v2.md.

import { getDb } from '../db/client';
import type { GateDecision, ConnectionDegree } from '@shared/types';

const norm = (s: string) => s.trim().toLowerCase();

// Phase 0.5 — DNC cross-check (free, fast, db grep).
export function dncCheck(userId: number, name: string): GateDecision {
  const conn = getDb();
  const hit = conn
    .prepare('SELECT name_norm, company, reason FROM dnc WHERE user_id = ? AND name_norm = ?')
    .get(userId, norm(name)) as { name_norm: string; company: string; reason: string } | undefined;
  if (hit) {
    return {
      phase: '0.5',
      decision: 'drop',
      reason: `DNC: ${hit.reason || 'permanent skip'}`,
      meta: { company: hit.company }
    };
  }
  return { phase: '0.5', decision: 'pass' };
}

// Phase 0.6 — prior-contact ladder. Checks 4 sources:
//   1. prior_contacts table (MASTER_SENT_LIST seed)
//   2. dnc table (explicit Do Not Contact list)
//   3. outreach table (anything we've drafted/sent in this app)
//   4. accepts/replies that may indicate ongoing engagement
// Drops on any hit; reports which sources matched so the user can override
// with full context.
export function priorContactCheck(userId: number, name: string, linkedinUrl?: string): GateDecision {
  const conn = getDb();
  const nameNorm = norm(name);

  // Source 1: MASTER_SENT_LIST seed.
  const masterHits = conn
    .prepare(
      `SELECT channel, send_date FROM prior_contacts
       WHERE user_id = ? AND name_norm = ? ORDER BY send_date DESC LIMIT 5`
    )
    .all(userId, nameNorm) as Array<{ channel: string; send_date: string }>;

  // Source 2: explicit DNC list.
  const dncHit = conn
    .prepare(`SELECT name_norm, company, reason FROM dnc WHERE user_id = ? AND name_norm = ?`)
    .get(userId, nameNorm) as { name_norm: string; company: string | null; reason: string | null } | undefined;

  // Source 3: existing outreach in this app (any motion, any status that implies "we already touched them").
  const ourSends = linkedinUrl
    ? (conn
        .prepare(
          `SELECT o.id, o.motion, o.status, o.drafted_at, o.sent_at
           FROM outreach o JOIN prospects p ON p.id = o.prospect_id
           WHERE o.user_id = ? AND p.linkedin_url = ?
             AND o.status IN ('sent','accepted','replied','declined','queued')
           ORDER BY o.drafted_at DESC LIMIT 5`
        )
        .all(userId, linkedinUrl) as Array<{ id: number; motion: string; status: string; drafted_at: string; sent_at: string | null }>)
    : [];

  // Source 4: warm-engagement signal — replies/accepts in last 90 days on any prospect with this name.
  const warmHits = conn
    .prepare(
      `SELECT o.status, o.replied_at, o.accepted_at, p.full_name
       FROM outreach o JOIN prospects p ON p.id = o.prospect_id
       WHERE o.user_id = ? AND lower(p.full_name) = ?
         AND o.status IN ('accepted','replied')
         AND COALESCE(o.replied_at, o.accepted_at) > datetime('now', '-90 days')
       LIMIT 3`
    )
    .all(userId, nameNorm) as Array<{ status: string; replied_at: string | null; accepted_at: string | null; full_name: string }>;

  const sources: string[] = [];
  if (masterHits.length > 0) sources.push(`master_sent_list (${masterHits.length}, latest ${masterHits[0].send_date} via ${masterHits[0].channel})`);
  if (dncHit) sources.push(`dnc (${dncHit.reason ?? 'no reason given'})`);
  if (ourSends.length > 0) sources.push(`app outreach (${ourSends.length}, latest ${ourSends[0].sent_at ?? ourSends[0].drafted_at} ${ourSends[0].motion}/${ourSends[0].status})`);
  if (warmHits.length > 0) sources.push(`warm engagement (${warmHits.length} accept/reply in last 90d)`);

  if (sources.length === 0) {
    return { phase: '0.6', decision: 'pass' };
  }

  return {
    phase: '0.6',
    decision: 'drop',
    reason: `prior contact across ${sources.length} source(s): ${sources.join(' · ')}`,
    meta: { sources, masterHits, dncHit, ourSends, warmHits }
  };
}

// Phase 1.5 sub-check — wrong-company detection. Apollo says one employer,
// LinkedIn (live capture) shows a different one. Per the v2 BDR skill (Raj Parmar
// pattern: Apollo said Chase, LinkedIn was Cardinal Health), the LinkedIn
// employer wins, but the discrepancy itself should drop or strongly warn.
export function wrongCompanyCheck(
  apolloCompany: string | null,
  linkedinCompany: string | null
): GateDecision | null {
  if (!apolloCompany || !linkedinCompany) return null;
  const a = apolloCompany.trim().toLowerCase().replace(/\s+(inc\.?|llc|corp\.?|ltd\.?|gmbh|sa|se|plc)$/i, '');
  const l = linkedinCompany.trim().toLowerCase().replace(/\s+(inc\.?|llc|corp\.?|ltd\.?|gmbh|sa|se|plc)$/i, '');
  if (a === l) return null;
  // Loose tolerance: one is a substring of the other (e.g., "Microsoft" vs "Microsoft Corp").
  if (a.includes(l) || l.includes(a)) return null;
  // Hard mismatch.
  return {
    phase: '1.5',
    decision: 'drop',
    reason: `wrong-company mismatch: Apollo says "${apolloCompany}" but LinkedIn shows "${linkedinCompany}". Drop to avoid mis-targeting (Raj Parmar pattern).`,
    meta: { apolloCompany, linkedinCompany }
  };
}

// Phase 1.5 — TAM-scope verify. Domain (preferred) or company-name match against accounts table.
export function tamScopeCheck(
  userId: number,
  candidate: { company_name?: string | null; domain?: string | null }
): GateDecision {
  const conn = getDb();
  if (candidate.domain) {
    const dom = norm(candidate.domain);
    const hit = conn
      .prepare('SELECT id, name, tier FROM accounts WHERE user_id = ? AND domain = ?')
      .get(userId, dom) as { id: number; name: string; tier: string } | undefined;
    if (hit) {
      return {
        phase: '1.5',
        decision: 'pass',
        meta: { account_id: hit.id, account_name: hit.name, tier: hit.tier }
      };
    }
  }
  if (candidate.company_name) {
    const name = candidate.company_name.trim();
    const hit = conn
      .prepare(
        `SELECT id, name, tier FROM accounts
         WHERE user_id = ? AND name COLLATE NOCASE = ? COLLATE NOCASE`
      )
      .get(userId, name) as { id: number; name: string; tier: string } | undefined;
    if (hit) {
      return {
        phase: '1.5',
        decision: 'pass',
        meta: { account_id: hit.id, account_name: hit.name, tier: hit.tier }
      };
    }
    // Loose match — common when LinkedIn shortens names ("Microsoft Corp" vs "Microsoft").
    const loose = conn
      .prepare(
        `SELECT id, name, tier FROM accounts
         WHERE user_id = ? AND name LIKE ? COLLATE NOCASE LIMIT 1`
      )
      .get(userId, `%${name}%`) as { id: number; name: string; tier: string } | undefined;
    if (loose) {
      return {
        phase: '1.5',
        decision: 'warn',
        reason: `loose company-name match: "${candidate.company_name}" → "${loose.name}"`,
        meta: { account_id: loose.id, account_name: loose.name, tier: loose.tier }
      };
    }
  }
  return {
    phase: '1.5',
    decision: 'drop',
    reason: 'company not in TAM/Factor/G2 — out of scope',
    meta: candidate
  };
}

// Phase 0.7 — degree gate. 1st-degree drops to a separate DM batch (don't waste InMail/connect-credit).
export function degreeCheck(degree: ConnectionDegree | null): GateDecision {
  if (!degree) {
    return { phase: '0.7', decision: 'warn', reason: 'degree could not be determined' };
  }
  if (degree === '1st') {
    return {
      phase: '0.7',
      decision: 'drop',
      reason: '1st-degree connection — already connected, route to DM batch instead',
      meta: { degree }
    };
  }
  return { phase: '0.7', decision: 'pass', meta: { degree } };
}

// Phase 0.7.5 — deliverability pre-check. INC-030 protection: connections<20 AND followers<20 = drop.
// connections<50 OR followers<50 = warn (send last in any batch).
export function deliverabilityCheck(
  connections: number | null,
  followers: number | null
): GateDecision {
  const c = connections ?? 0;
  const f = followers ?? 0;
  if (c < 20 && f < 20) {
    return {
      phase: '0.7.5',
      decision: 'drop',
      reason: `near-empty profile (connections=${c}, followers=${f}) — INC-030 high risk`,
      meta: { connections: c, followers: f }
    };
  }
  if (c < 50 || f < 50) {
    return {
      phase: '0.7.5',
      decision: 'warn',
      reason: `low engagement (connections=${c}, followers=${f}) — send last`,
      meta: { connections: c, followers: f }
    };
  }
  return { phase: '0.7.5', decision: 'pass', meta: { connections: c, followers: f } };
}

// Phase 3 — Apollo dedup. Driven by the Apollo provider abstraction (api | ui | none).
// Returns pass with metadata in all cases; only drops on confirmed in-campaign signal.
// Also persists enrichment data to prospects.apollo_company/title/employment when
// the API provider is active so the wrong-company gate (1.5b) can fire and the
// auto-prospect-enroll flow can reason over career arcs.
export async function apolloDedupCheck(
  userId: number,
  candidate: { linkedinUrl?: string; name?: string; company?: string; prospectId?: number }
): Promise<GateDecision> {
  const { getApolloMode, getProvider } = await import('./apollo');
  const mode = getApolloMode();
  if (mode.resolved === 'none') {
    return {
      phase: '3',
      decision: 'pass',
      reason: 'Apollo dedup off — relying on local prior-contact gate',
      meta: { mode: mode.preference, resolved: mode.resolved }
    };
  }
  try {
    const provider = getProvider(userId);
    const result = await provider.match({
      linkedinUrl: candidate.linkedinUrl,
      name: candidate.name,
      company: candidate.company
    });
    if (!result.ok) {
      return {
        phase: '3',
        decision: 'warn',
        reason: `Apollo dedup degraded: ${result.error ?? 'unknown'}`,
        meta: { mode: mode.preference, resolved: mode.resolved, source: result.source }
      };
    }
    // Persist enrichment data into prospects so 1.5b wrong-company can use it.
    if (candidate.prospectId && (result._apolloCompany || result._apolloTitle || result._apolloEmployment)) {
      try {
        getDb()
          .prepare(
            `UPDATE prospects SET
              apollo_id = COALESCE(?, apollo_id),
              apollo_company = COALESCE(?, apollo_company),
              apollo_title = COALESCE(?, apollo_title),
              apollo_employment = COALESCE(?, apollo_employment)
             WHERE id = ?`
          )
          .run(
            result.apolloId ?? null,
            result._apolloCompany ?? null,
            result._apolloTitle ?? null,
            result._apolloEmployment ?? null,
            candidate.prospectId
          );
      } catch {
        // best-effort persistence; never blocks gate
      }
    }
    if (result.inActiveCampaign) {
      return {
        phase: '3',
        decision: 'drop',
        reason: 'Apollo: contact already in an active campaign (Factor-First or other auto-enroll) — drop to avoid double-touch',
        meta: { mode: mode.preference, source: result.source, apolloId: result.apolloId, emailerCampaignIds: result.emailerCampaignIds }
      };
    }
    return {
      phase: '3',
      decision: 'pass',
      reason: `Apollo dedup clean (source=${result.source})`,
      meta: { mode: mode.preference, source: result.source, apolloId: result.apolloId }
    };
  } catch (err) {
    return {
      phase: '3',
      decision: 'warn',
      reason: `Apollo dedup error: ${err instanceof Error ? err.message : String(err)}`,
      meta: { mode: mode.preference }
    };
  }
}
