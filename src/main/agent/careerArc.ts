// Career-arc detection — uses the Rung 4 /details/experience/ subpage capture
// to detect persona-mismatch patterns the v2 BDR skill calls out: claims-ops
// trajectory (Marcela Fetters), banking compliance/audit, hardware/defense
// systems engineering, clinical/pharma QA. These are the patterns that look
// fine at Rung 1 (job title says "Director of QA") but reveal themselves
// in the full Experience history.

export interface CareerArcSignal {
  pattern: string;          // 'claims-ops' | 'banking-compliance' | 'hardware-defense' | 'clinical-pharma' | 'career-grown-internal'
  evidence: string;         // first ~200 chars of the matching subpage section
  confidence: 'high' | 'medium' | 'low';
}

interface AnalysisInput {
  experienceSubpage: string | null;
  liveHeadline: string | null;
  apolloEmployment: string | null;  // JSON array
}

// Pattern definitions. Each pattern has multiple keyword indicators; we require
// at least 2 to fire (low-confidence: 2; medium: 3; high: 4+).
const PATTERNS: Array<{ id: string; keywords: RegExp[]; description: string }> = [
  {
    id: 'claims-ops',
    description: 'Insurance Claims Operations career arc (Marcela Fetters pattern)',
    keywords: [
      /\bclaims adjuster\b/i,
      /\bclaims supervisor\b/i,
      /\bclaims manager\b/i,
      /\bSCLA\b/,                         // Senior Claims Law Associate credential
      /\bbodily injury\b/i,
      /\bfirst[-\s]?party\b/i,
      /\bcasualty\b/i,
      /\bsubrogation\b/i,
      /\bliability dept\b/i
    ]
  },
  {
    id: 'banking-compliance',
    description: 'Banking-flavored Director of QA = compliance / audit / risk (Sabrina Perry pattern)',
    keywords: [
      /\bAML\b/,
      /\bKYC\b/,
      /\bBSA\b/,                          // Bank Secrecy Act
      /\bFINRA\b/,
      /\bSOX\b/,                          // Sarbanes-Oxley
      /\binternal audit\b/i,
      /\bregulatory affairs\b/i,
      /\brisk assurance\b/i,
      /\boperational risk\b/i,
      /\bcompliance testing\b/i,
      /\bretail banking\b/i,
      /\binvestment ops\b/i
    ]
  },
  {
    id: 'hardware-defense',
    description: 'Hardware / defense / aerospace systems engineering (Brian Nysse / Kevin Kirkpatrick pattern)',
    keywords: [
      /\bmechanical engineering\b/i,
      /\boff[-\s]?road\s+vehicles?\b/i,
      /\bsatellite\b/i,
      /\bfirmware\b/i,
      /\bdefense\b/i,
      /\bDoD\b/,
      /\bUSAF\b/,
      /\bSITEC\b/,
      /\bmanitowoc|XCMG|Polaris\b/i,
      /\baerospace\b/i,
      /\bavionics\b/i,
      /\bhardware\s+(qa|test)\b/i,
      /\bweapons\b/i
    ]
  },
  {
    id: 'clinical-pharma',
    description: 'Clinical / pharmaceutical QA (Stephanie Reddick / Venkateshwarlu Gajjela pattern)',
    keywords: [
      /\bGMP\b/,
      /\bGxP\b/i,
      /\bFDA\b/,
      /\bCAR[-\s]?T\b/i,
      /\bcell therapy\b/i,
      /\bclinical trial\b/i,
      /\bpharmaceutical\b/i,
      /\bbiotech\b/i,
      /\bbiopharm/i,
      /\bradiology\b/i,
      /\bIQVIA\b/,
      /\bcryo[-\s]?cell\b/i,
      /\bregulatory submission\b/i
    ]
  }
];

// Career-grown-internal is a positive signal — same company for 8+ years with
// promotion arc. Aleksandar at Sysdig: SWE → EM → Sr EM → Director.
//
// Two detection paths:
//   1. Structured: parse Apollo's `apollo_employment` JSON via insightsFromJson
//      (precise — knows roles + tenure exactly). PREFERRED.
//   2. Regex fallback over text: when Apollo employment isn't available, look
//      for "X+ years at Company" mentions in the captured experience text.
const CAREER_GROWN_RE = /\b(\d+)\+?\s*y(?:ea)?rs?\s*(?:at|with)\b/i;

import { insightsFromJson, type EmploymentInsights } from './apolloEmployment';

export function analyzeCareerArc(input: AnalysisInput): CareerArcSignal[] {
  const signals: CareerArcSignal[] = [];
  const text = `${input.experienceSubpage ?? ''}\n${input.liveHeadline ?? ''}\n${input.apolloEmployment ?? ''}`;
  if (!text.trim()) return signals;

  for (const pat of PATTERNS) {
    const matches = pat.keywords.filter((re) => re.test(text));
    if (matches.length < 2) continue;
    const confidence = matches.length >= 4 ? 'high' : matches.length >= 3 ? 'medium' : 'low';
    // Find a representative snippet to surface as evidence.
    const firstMatch = matches[0];
    const m = text.match(firstMatch);
    const idx = m && typeof m.index === 'number' ? m.index : 0;
    const evidence = text.slice(Math.max(0, idx - 60), idx + 140).replace(/\s+/g, ' ').trim();
    signals.push({
      pattern: pat.id,
      evidence: `${pat.description}: …${evidence}…`,
      confidence
    });
  }

  // Career-grown-internal: prefer the structured Apollo employment_history.
  // The parser is precise (counts distinct titles + computes continuous tenure).
  // If we got a positive signal from structured data, skip the regex fallback.
  let structuredCareerGrown = false;
  const insights: EmploymentInsights = insightsFromJson(input.apolloEmployment);
  if (insights.careerGrownInternal.detected) {
    signals.push({
      pattern: 'career-grown-internal',
      evidence: `${insights.careerGrownInternal.yearsAtEmployer}y at ${insights.careerGrownInternal.employer ?? 'employer'} across ${insights.careerGrownInternal.rolesCount} roles (Apollo-verified, Aleksandar pattern)`,
      confidence: 'high'
    });
    structuredCareerGrown = true;
  }

  // Job-hopper signal: 4+ distinct employers in the last 5 years. Not a drop —
  // surfaces in the gate log so the user can choose to skip.
  if (insights.jobHopper.detected) {
    signals.push({
      pattern: 'job-hopper',
      evidence: `${insights.jobHopper.employersInLast5Years} distinct employers in last 5 years (Apollo-verified)`,
      confidence: 'low'
    });
  }

  // Regex fallback only when structured data didn't already confirm.
  if (!structuredCareerGrown) {
    const yearsMatch = text.match(CAREER_GROWN_RE);
    if (yearsMatch) {
      const years = Number(yearsMatch[1]);
      if (years >= 8) {
        signals.push({
          pattern: 'career-grown-internal',
          evidence: `${years}+ years at one company — likely career-grown arc (text-only inference)`,
          confidence: 'medium'
        });
      }
    }
  }

  return signals;
}

// Returns true if any signal is a high-confidence persona-mismatch (auto-drop).
// career-grown-internal and job-hopper are informational, never cause a drop.
const NON_BLOCKING_SIGNALS = new Set(['career-grown-internal', 'job-hopper']);

export function shouldDropOnCareerArc(signals: CareerArcSignal[]): { drop: boolean; reason: string | null } {
  const blockers = signals.filter(
    (s) => !NON_BLOCKING_SIGNALS.has(s.pattern) && (s.confidence === 'high' || s.confidence === 'medium')
  );
  if (blockers.length === 0) return { drop: false, reason: null };
  return {
    drop: true,
    reason: `career-arc mismatch: ${blockers.map((s) => `${s.pattern} (${s.confidence})`).join(', ')}`
  };
}
