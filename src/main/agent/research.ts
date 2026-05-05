// Research module: capture LinkedIn profile -> persist Evidence row.

import { getDb } from '../db/client';
import { capturePublicProfile, type ProfileCapture } from '../browser/linkedin';
import { withWatchdog, WATCHDOG } from '../browser/watchdog';
import type { ActivityStatus } from '@shared/types';

export interface AutoDropSignal {
  pattern: string;          // e.g. 'open-to-work', 'retired', 'ex-prefix', 'sparse-profile'
  evidence: string;         // the verbatim text that matched
}

export interface ResearchResult {
  prospect_id: number;
  evidence_id: number;
  capture: ProfileCapture;
  activity_status: ActivityStatus;
  autoDropSignals: AutoDropSignal[];
  tenureInCurrentRoleMonths: number | null;
}

function deriveSlug(url: string): string {
  const m = url.match(/\/in\/([^/?#]+)/);
  return m ? decodeURIComponent(m[1]) : url;
}

function classifyActivity(capture: ProfileCapture): ActivityStatus {
  // Conservative: anything fewer than 3 substantive recent activity items = LINKEDIN-QUIET.
  // Substantive = activity text >= 80 chars (filters out "1d •" badges).
  const substantive = capture.recent_activity_text.filter((t) => t.length >= 80);
  return substantive.length >= 3 ? 'ACTIVE' : 'LINKEDIN-QUIET';
}

// Auto-drop signals from the v2 LinkedIn skill (Apr 30, 2026 lock).
// Patterns to drop on sight: Retired, Open to Work, Ex-, BPO/CX/Data Entry, software-dev-not-QA.
function detectAutoDropSignals(capture: ProfileCapture): AutoDropSignal[] {
  const signals: AutoDropSignal[] = [];
  const headline = (capture.headline || '').toLowerCase();
  const about = (capture.about || '').toLowerCase();

  if (/^\s*(retired|self[-\s]?employed)\b/.test(headline)) {
    signals.push({ pattern: 'retired', evidence: capture.headline ?? '' });
  }
  if (/\bopen to work\b|actively seeking|i'?m looking for/.test(headline) || /actively seeking|open to opportunities/.test(about)) {
    signals.push({ pattern: 'open-to-work', evidence: capture.headline ?? '' });
  }
  if (/^\s*ex[-\s]/i.test(capture.headline ?? '')) {
    signals.push({ pattern: 'ex-prefix', evidence: capture.headline ?? '' });
  }
  if (/\b(data entry|customer experience|cx)\b/.test(headline) && /\b(manila|iloilo|philippines)\b/.test((capture.location || '').toLowerCase())) {
    signals.push({ pattern: 'bpo-cx-data-entry', evidence: `${capture.headline} · ${capture.location}` });
  }
  if (/\bsr\.?\s*software engineer\b/.test(headline) && !/qa|test|quality|sdet/.test(headline)) {
    signals.push({ pattern: 'software-dev-not-qa', evidence: capture.headline ?? '' });
  }
  if (/\b(risk pro|aml|cdd|investment ops|retail banking)\b/.test(headline)) {
    signals.push({ pattern: 'banking-risk-aml', evidence: capture.headline ?? '' });
  }
  if (/\b(claims adjuster|claims supervisor|sla|insurance agent)\b/.test(headline)) {
    signals.push({ pattern: 'insurance-claims-ops', evidence: capture.headline ?? '' });
  }
  // Sparse profile (already caught by Phase 0.7.5 deliverability, but flagged here for context too).
  const conn = capture.connection_count ?? 0;
  const fol = capture.follower_count ?? 0;
  if (conn < 20 && fol < 20) {
    signals.push({ pattern: 'sparse-profile', evidence: `connections=${conn} followers=${fol}` });
  }
  return signals;
}

// Heuristic tenure-in-current-role estimate from headline / about text.
// Returns null if can't determine confidently. The LLM will treat null as UNKNOWN bucket.
function deriveTenureMonths(capture: ProfileCapture): number | null {
  const blob = `${capture.headline ?? ''} ${capture.about ?? ''}`.toLowerCase();
  // Look for "X+ years at Company" / "X years as Title" patterns.
  const yrMatch = blob.match(/(\d{1,2})(?:\s*\+|\s*plus)?\s*years?\s+(?:at|as)/i);
  if (yrMatch) {
    const yrs = Number(yrMatch[1]);
    if (yrs > 0 && yrs < 40) return yrs * 12;
  }
  const moMatch = blob.match(/(\d{1,3})\s*months?\s+(?:at|as)/i);
  if (moMatch) {
    const mos = Number(moMatch[1]);
    if (mos > 0 && mos < 480) return mos;
  }
  return null;
}

export async function researchProspect(
  userId: number,
  profileUrl: string
): Promise<ResearchResult> {
  const conn = getDb();
  const capture = await withWatchdog(
    'profile-capture',
    WATCHDOG.PROFILE_CAPTURE_MS,
    () => capturePublicProfile(userId, profileUrl)
  );
  if (!capture.full_name) {
    throw new Error('LinkedIn profile capture failed — no name extracted (check login)');
  }

  // Upsert prospect.
  const slug = deriveSlug(capture.url);
  const existing = conn
    .prepare('SELECT id FROM prospects WHERE user_id = ? AND linkedin_url = ?')
    .get(userId, capture.url) as { id: number } | undefined;

  let prospectId: number;
  if (existing) {
    prospectId = existing.id;
    conn
      .prepare(
        `UPDATE prospects SET full_name = ?, first_name = ?, last_name = ?,
         linkedin_slug = ?, title = ?, company_name = ? WHERE id = ?`
      )
      .run(
        capture.full_name,
        capture.first_name,
        capture.last_name,
        slug,
        capture.current_title,
        capture.current_company,
        prospectId
      );
  } else {
    const info = conn
      .prepare(
        `INSERT INTO prospects (user_id, full_name, first_name, last_name, linkedin_url,
         linkedin_slug, title, company_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        userId,
        capture.full_name,
        capture.first_name,
        capture.last_name,
        capture.url,
        slug,
        capture.current_title,
        capture.current_company
      );
    prospectId = Number(info.lastInsertRowid);
  }

  const status = classifyActivity(capture);
  const autoDropSignals = detectAutoDropSignals(capture);
  const tenureInCurrentRoleMonths = deriveTenureMonths(capture);

  const notes = autoDropSignals.length > 0
    ? `auto-drop signals: ${autoDropSignals.map((s) => s.pattern).join(', ')}`
    : null;

  const evInfo = conn
    .prepare(
      `INSERT INTO evidence (
        prospect_id, captured_via, live_headline, live_location, connection_degree,
        follower_count, connection_count, activity_status, activity_quotes,
        evidence_quote_for_hook, raw_capture, notes, experience_subpage
      ) VALUES (?, 'public-profile', ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?)`
    )
    .run(
      prospectId,
      capture.headline,
      capture.location,
      capture.connection_degree,
      capture.follower_count,
      capture.connection_count,
      status,
      JSON.stringify(capture.recent_activity_text),
      capture.raw_text.slice(0, 50_000),
      notes,
      capture.experience_subpage
    );
  const evidenceId = Number(evInfo.lastInsertRowid);

  return {
    prospect_id: prospectId,
    evidence_id: evidenceId,
    capture,
    activity_status: status,
    autoDropSignals,
    tenureInCurrentRoleMonths
  };
}

export function setHookQuote(evidenceId: number, quote: string): void {
  getDb().prepare('UPDATE evidence SET evidence_quote_for_hook = ? WHERE id = ?').run(quote, evidenceId);
}
