// Tests for the career-arc detection module.

import { describe, it, expect } from 'vitest';
import { analyzeCareerArc, shouldDropOnCareerArc } from '../src/main/agent/careerArc';

describe('analyzeCareerArc', () => {
  it('returns no signals on empty input', () => {
    expect(analyzeCareerArc({ experienceSubpage: null, liveHeadline: null, apolloEmployment: null })).toEqual([]);
  });

  it('detects claims-ops trajectory (Marcela Fetters pattern)', () => {
    const signals = analyzeCareerArc({
      experienceSubpage: `
        Director of Quality Assurance · 2022 - Present
          Leading quality and process improvement.
        Director, Operations - First Party Medical · 2018 - 2022
          Managed liability dept and bodily injury claims.
        Liability Dept Manager · 2014 - 2018
        Contact Center Manager · 2010 - 2014
        Claims Supervisor · 2006 - 2010
        Claims Adjuster · 2003 - 2006
      `,
      liveHeadline: 'Director of QA at Acme Insurance',
      apolloEmployment: null
    });
    const claims = signals.find((s) => s.pattern === 'claims-ops');
    expect(claims).toBeDefined();
    expect(claims?.confidence).toMatch(/medium|high/);
  });

  it('detects banking-compliance pattern', () => {
    const signals = analyzeCareerArc({
      experienceSubpage: `
        VP Quality Assurance · Big Bank
        Led AML/KYC monitoring and SOX compliance testing.
        Internal audit lead — operational risk frameworks.
        Previously regulatory affairs at a retail banking org.
      `,
      liveHeadline: 'VP Quality Assurance',
      apolloEmployment: null
    });
    const compliance = signals.find((s) => s.pattern === 'banking-compliance');
    expect(compliance).toBeDefined();
  });

  it('detects hardware-defense pattern', () => {
    const signals = analyzeCareerArc({
      experienceSubpage: `
        Sr Engineering Manager — Off-Road Vehicles
        Mechanical engineering background, USAF veteran.
        Previously firmware lead at defense contractor.
        Worked on weapons platforms and avionics integration.
      `,
      liveHeadline: 'Director Engineering at Polaris',
      apolloEmployment: null
    });
    const hw = signals.find((s) => s.pattern === 'hardware-defense');
    expect(hw).toBeDefined();
  });

  it('detects clinical-pharma pattern', () => {
    const signals = analyzeCareerArc({
      experienceSubpage: `
        Senior Manager, GMP Quality
        FDA submissions, clinical trial oversight, CAR-T cell therapy programs.
        Pharmaceutical regulatory submission lead.
      `,
      liveHeadline: 'QA Director',
      apolloEmployment: null
    });
    const clin = signals.find((s) => s.pattern === 'clinical-pharma');
    expect(clin).toBeDefined();
  });

  it('flags career-grown-internal as positive signal (not a drop)', () => {
    const signals = analyzeCareerArc({
      experienceSubpage: `
        Director of Engineering at Sysdig · 2025 - Present
        Sr Engineering Manager · 2023 - 2025
        Engineering Manager · 2021 - 2023
        Software Engineer · 2017 - 2021
        9 years at Sysdig
      `,
      liveHeadline: 'Director Engineering at Sysdig',
      apolloEmployment: null
    });
    const grown = signals.find((s) => s.pattern === 'career-grown-internal');
    expect(grown).toBeDefined();
    // shouldDropOnCareerArc must NOT drop on career-grown-internal alone.
    expect(shouldDropOnCareerArc([grown!])).toEqual({ drop: false, reason: null });
  });

  it('does not match clean software-QA persona', () => {
    const signals = analyzeCareerArc({
      experienceSubpage: `
        Senior SDET at Acme Software
        Built Selenium and Cypress automation suites for the web platform.
        Test automation lead for our microservices integration tests.
      `,
      liveHeadline: 'Senior SDET',
      apolloEmployment: null
    });
    expect(signals.filter((s) => s.pattern !== 'career-grown-internal')).toEqual([]);
  });

  it('shouldDropOnCareerArc drops on medium+ blockers', () => {
    const signals = [
      { pattern: 'claims-ops', evidence: 'x', confidence: 'high' as const },
      { pattern: 'career-grown-internal', evidence: 'y', confidence: 'medium' as const }
    ];
    const r = shouldDropOnCareerArc(signals);
    expect(r.drop).toBe(true);
    expect(r.reason).toMatch(/claims-ops/);
  });

  it('shouldDropOnCareerArc does not drop on low-confidence-only blocker', () => {
    const signals = [{ pattern: 'banking-compliance', evidence: 'x', confidence: 'low' as const }];
    expect(shouldDropOnCareerArc(signals)).toEqual({ drop: false, reason: null });
  });
});
