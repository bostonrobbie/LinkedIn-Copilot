// Drafting module. Builds a connection-request draft using the locked formula.
// Hook generation: LLM (Anthropic Sonnet) if API key present, else heuristic fallback.

import type { Dept, Draft } from '@shared/types';
import type { ProfileCapture } from '../browser/linkedin';
import { generateHook } from './llm';

const TEMPLATE =
  "Hi {First}, I'm at Testsigma, AI-powered test automation, and I connect with {dept} to share what we're building. Your {hook} is what caught my attention. Happy to connect if that sounds worthwhile. Rob";

export const TEMPLATE_HARD_CONSTRAINTS = {
  minChars: 229,
  maxChars: 278,
  forbiddenChars: ['—', '?'],
  requiredPhrases: ['AI-powered test automation', 'Happy to connect if that sounds worthwhile.'],
  signoff: 'worthwhile. Rob'
};

const DEPT_RULES: Array<{ keywords: RegExp; dept: Dept }> = [
  { keywords: /\b(SDET|automation|test automation|automation engineer|automation lead)\b/i, dept: 'automation leaders' },
  { keywords: /\b(QE|quality engineering)\b/i, dept: 'QE leaders' },
  { keywords: /\b(QA|quality assurance|test|testing)\b/i, dept: 'QA leaders' },
  { keywords: /\b(VP|director|head|manager)\b.*\b(engineering|software|platform|technology)\b/i, dept: 'engineering leaders' },
  { keywords: /\b(engineering|software|platform|developer)\b/i, dept: 'engineering leaders' }
];

export function pickDept(headline: string | null, title: string | null): Dept {
  const blob = `${headline || ''} ${title || ''}`;
  for (const rule of DEPT_RULES) {
    if (rule.keywords.test(blob)) return rule.dept;
  }
  return 'QA leaders';
}

export interface BuildDraftResult extends Draft {
  evidenceQuote: string;
  hookSource: 'llm' | 'heuristic';
  tier: 'A' | 'A+' | 'A++' | null;
}

// Tier classification from the inputs (mirrors the v2 BDR skill's hook tier
// framework: A = LINKEDIN-QUIET tenure-only floor; A+ = substantive activity
// not directly recipient-relevant; A++ = recipient-amplified or recipient-published).
function classifyTier(args: {
  activityStatus: 'LINKEDIN-QUIET' | 'ACTIVE';
  evidenceQuote: string;
  recentActivity: string[];
  liveHeadline: string | null;
}): 'A' | 'A+' | 'A++' {
  const { activityStatus, evidenceQuote, recentActivity } = args;
  if (activityStatus === 'LINKEDIN-QUIET' || recentActivity.length === 0) {
    return 'A';
  }
  // Tier A++: hook quote is verbatim from a recent activity item (recipient amplified/published).
  const quote = (evidenceQuote ?? '').toLowerCase();
  if (quote && recentActivity.some((act) => act.toLowerCase().includes(quote.slice(0, 30)))) {
    return 'A++';
  }
  // Otherwise A+ — substantive activity exists but the hook isn't anchored to it.
  return 'A+';
}

export async function buildDraft(args: {
  firstName: string;
  capture: ProfileCapture;
  tenureInCurrentRoleMonths?: number | null;
}): Promise<BuildDraftResult> {
  const { firstName, capture, tenureInCurrentRoleMonths } = args;
  const dept = pickDept(capture.headline, capture.current_title);

  const activityStatus =
    capture.recent_activity_text.filter((t) => t.length >= 80).length >= 3
      ? 'ACTIVE'
      : 'LINKEDIN-QUIET';

  const gen = await generateHook({
    firstName,
    fullName: capture.full_name,
    liveHeadline: capture.headline,
    about: capture.about,
    currentTitle: capture.current_title,
    currentCompany: capture.current_company,
    recentActivity: capture.recent_activity_text,
    activityStatus,
    tenureInCurrentRoleMonths: tenureInCurrentRoleMonths ?? null
  });

  const hook = gen.hook.trim();
  const body = TEMPLATE.replace('{First}', firstName)
    .replace('{dept}', dept)
    .replace('{hook}', hook);

  const tier = classifyTier({
    activityStatus,
    evidenceQuote: gen.evidenceQuote,
    recentActivity: capture.recent_activity_text,
    liveHeadline: capture.headline
  });

  return {
    motion: 'connection_request',
    body,
    hook,
    dept,
    char_count: body.length,
    evidenceQuote: gen.evidenceQuote,
    hookSource: gen.source,
    tier
  };
}
