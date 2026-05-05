// Pre-baked demo prospects for safe rehearsal and demo-day fallback.
// Inserts prospects + evidence + outreach rows that look like a real captured run.
// Status starts at 'draft' so the user can demo Approve & Send (or Simulate Send).

import { getDb } from '../db/client';

interface DemoSeed {
  full_name: string;
  first_name: string;
  last_name: string;
  linkedin_url: string;
  linkedin_slug: string;
  title: string;
  company_name: string;
  evidence: {
    live_headline: string;
    live_location: string;
    connection_degree: '2nd' | '3rd';
    follower_count: number;
    connection_count: number;
    activity_status: 'LINKEDIN-QUIET' | 'ACTIVE';
    activity_quotes: string[];
    evidence_quote_for_hook: string;
  };
  draft: {
    motion: 'connection_request' | 'sales_nav_inmail';
    body: string;
    subject: string | null;
    hook: string;
    dept: string;
    confidence: number;
    confidence_notes: object;
  };
}

const SEEDS: DemoSeed[] = [
  {
    full_name: 'Rami Bendalak',
    first_name: 'Rami',
    last_name: 'Bendalak',
    linkedin_url: 'https://www.linkedin.com/in/rami-bendalak-b6a7713/',
    linkedin_slug: 'rami-bendalak-b6a7713',
    title: 'Sr. Director of Engineering, IL Site Leader',
    company_name: 'SailPoint',
    evidence: {
      live_headline: 'Sr. Director of Engineering, IL Site Leader at SailPoint',
      live_location: 'Israel',
      connection_degree: '3rd',
      follower_count: 1115,
      connection_count: 500,
      activity_status: 'ACTIVE',
      activity_quotes: [
        'Reposted SailPoint EVP/CTO Chandra Gnanasambandam: "SailPoint Identity Security Accelerator now integrated with the Extended plan in AWS Security Hub" (~2mo ago)'
      ],
      evidence_quote_for_hook: 'SailPoint Identity Security Accelerator now integrated with the Extended plan in AWS Security Hub'
    },
    draft: {
      motion: 'sales_nav_inmail',
      subject: 'SailPoint + AWS Security Hub',
      body:
        "Hi Rami, I'm at Testsigma, AI-powered test automation. Saw your repost about SailPoint Identity Security Accelerator landing in the AWS Security Hub Extended plan, congrats. Hopefully its not too much to ask how testing has been holding up at SailPoint as that integration ships?\n\n" +
        "Reason I'm asking, when an identity security platform spans cloud security telemetry, identity governance, and a network of integrations, the testing surface tends to multiply fast. SaaS UI, API connectors, governance workflows, all hitting cross-stack scenarios at the same time.\n\n" +
        "CRED is one example. As their FinTech app scaled, they got to 90% automated regression coverage with 5x faster execution once AI took over the test authoring and self-healing work their team had been carrying manually.\n\n" +
        "Testsigma's Agent does that across web, mobile, and API. Plain-English test authoring, AI self-healing when locators break, and coverage gaps surfaced automatically as new features ship.\n\n" +
        "Curious if any of that sounds like what your team is running into at SailPoint?\n\nBest,\nRob",
      hook: 'repost about SailPoint Identity Security Accelerator landing in the AWS Security Hub Extended plan',
      dept: 'engineering leaders',
      confidence: 9.5,
      confidence_notes: {
        overall: 9.5,
        d1_formula: 10,
        d2_evidence: 10,
        d3_specificity: 9.5,
        fail_reasons: [],
        pass: true
      }
    }
  },
  {
    full_name: 'Gabija Juodžbalytė',
    first_name: 'Gabija',
    last_name: 'Juodžbalytė',
    linkedin_url: 'https://www.linkedin.com/in/gabija-juodzbalyte-25145457/',
    linkedin_slug: 'gabija-juodzbalyte-25145457',
    title: 'Director of Engineering',
    company_name: 'Rocket Software',
    evidence: {
      live_headline: 'Director of Engineering at Rocket Software',
      live_location: 'Vilnius, Lithuania',
      connection_degree: '3rd',
      follower_count: 661,
      connection_count: 500,
      activity_status: 'ACTIVE',
      activity_quotes: [
        '3mo ago: posted promoting SDSF (System Display Search Facility) Mainframe meetup in Vilnius featuring Rob Scott, Principal Architect at Rocket Software',
        '9mo ago: posted Rocket\'s mainframe monitoring product launch'
      ],
      evidence_quote_for_hook: 'SDSF meetup in Vilnius featuring Rob Scott, Principal Architect at Rocket Software'
    },
    draft: {
      motion: 'connection_request',
      subject: null,
      body:
        "Hi Gabija, I'm at Testsigma, AI-powered test automation, and I connect with engineering leaders to share what we're building. Your post about the Vilnius SDSF meetup with Rob Scott is what caught my attention. Happy to connect if that sounds worthwhile. Rob",
      hook: 'post about the Vilnius SDSF meetup with Rob Scott',
      dept: 'engineering leaders',
      confidence: 9.5,
      confidence_notes: {
        overall: 9.5,
        d1_formula: 10,
        d2_evidence: 10,
        d3_specificity: 9.0,
        fail_reasons: [],
        pass: true
      }
    }
  },
  {
    full_name: 'Barak Zabarai',
    first_name: 'Barak',
    last_name: 'Zabarai',
    linkedin_url: 'https://www.linkedin.com/in/barak-zabarai-0467194/',
    linkedin_slug: 'barak-zabarai-0467194',
    title: 'Software Engineering Senior Manager',
    company_name: 'Pathlock',
    evidence: {
      live_headline: 'Software Engineering Senior Manager | High tech | Cloud | End to End Development lead',
      live_location: 'Israel',
      connection_degree: '3rd',
      follower_count: 1431,
      connection_count: 500,
      activity_status: 'LINKEDIN-QUIET',
      activity_quotes: [],
      evidence_quote_for_hook: 'tenure-only — 2.5y at Pathlock per Apollo employment_history'
    },
    draft: {
      motion: 'sales_nav_inmail',
      subject: 'Two-plus years scaling Pathlock',
      body:
        "Hi Barak, I'm at Testsigma, AI-powered test automation. Hopefully its not too much to ask how testing has been holding up at Pathlock, two-plus years in?\n\n" +
        "Reason I'm asking, when a unified access orchestration platform spans SAP, Oracle, Workday, ServiceNow, and continuous controls monitoring, the testing surface tends to multiply fast. ERP integrations, role management, audit workflows, all hitting cross-stack scenarios at the same time.\n\n" +
        "CRED is one example. As their FinTech app scaled, they got to 90% automated regression coverage with 5x faster execution once AI took over the test authoring and self-healing work their team had been carrying manually.\n\n" +
        "Testsigma's Agent does that across web, mobile, and API. Plain-English test authoring, AI self-healing when locators break, and coverage gaps surfaced automatically as new features ship.\n\n" +
        "Curious if any of that sounds like what your team is running into at Pathlock?\n\nBest,\nRob",
      hook: 'two-plus years scaling Pathlock',
      dept: 'engineering leaders',
      confidence: 9.0,
      confidence_notes: {
        overall: 9.0,
        d1_formula: 10,
        d2_evidence: 9,
        d3_specificity: 9,
        fail_reasons: ['LINKEDIN-QUIET — tenure-only floor'],
        pass: true
      }
    }
  }
];

export function loadDemoSeeds(userId: number): { inserted: number } {
  const conn = getDb();

  // Idempotent: skip if any of the demo prospect URLs already exist for this user.
  const existing = conn
    .prepare(`SELECT COUNT(*) AS c FROM prospects WHERE user_id=? AND linkedin_url IN (${SEEDS.map(() => '?').join(',')})`)
    .get(userId, ...SEEDS.map((s) => s.linkedin_url)) as { c: number };
  if (existing.c > 0) return { inserted: 0 };

  let inserted = 0;
  const tx = conn.transaction(() => {
    for (const s of SEEDS) {
      const pInfo = conn
        .prepare(
          `INSERT INTO prospects (user_id, full_name, first_name, last_name, linkedin_url,
           linkedin_slug, title, company_name) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .run(userId, s.full_name, s.first_name, s.last_name, s.linkedin_url, s.linkedin_slug, s.title, s.company_name);
      const prospectId = Number(pInfo.lastInsertRowid);

      const eInfo = conn
        .prepare(
          `INSERT INTO evidence (
            prospect_id, captured_via, live_headline, live_location, connection_degree,
            follower_count, connection_count, activity_status, activity_quotes,
            evidence_quote_for_hook, raw_capture, notes
          ) VALUES (?, 'public-profile', ?, ?, ?, ?, ?, ?, ?, ?, NULL, 'demo seed')`
        )
        .run(
          prospectId,
          s.evidence.live_headline,
          s.evidence.live_location,
          s.evidence.connection_degree,
          s.evidence.follower_count,
          s.evidence.connection_count,
          s.evidence.activity_status,
          JSON.stringify(s.evidence.activity_quotes),
          s.evidence.evidence_quote_for_hook
        );
      const evidenceId = Number(eInfo.lastInsertRowid);

      conn
        .prepare(
          `INSERT INTO outreach (
            user_id, prospect_id, evidence_id, motion, draft_body, draft_subject,
            hook, dept, char_count, confidence, confidence_notes, status
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft')`
        )
        .run(
          userId,
          prospectId,
          evidenceId,
          s.draft.motion,
          s.draft.body,
          s.draft.subject,
          s.draft.hook,
          s.draft.dept,
          s.draft.body.length,
          s.draft.confidence,
          JSON.stringify(s.draft.confidence_notes)
        );
      inserted++;
    }
  });
  tx();
  return { inserted };
}
