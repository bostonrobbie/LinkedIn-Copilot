// Tests for the Apollo employment_history parser.

import { describe, it, expect } from 'vitest';
import { analyzeApolloEmployment, insightsFromJson, type ApolloEmploymentRow } from '../src/main/agent/apolloEmployment';

const yearsAgo = (n: number, m = 0): string => {
  const d = new Date();
  d.setFullYear(d.getFullYear() - n);
  d.setMonth(d.getMonth() - m);
  return d.toISOString().slice(0, 7);  // "YYYY-MM"
};

describe('analyzeApolloEmployment — empty input', () => {
  it('returns empty insights on null', () => {
    const r = analyzeApolloEmployment(null);
    expect(r.tenureCurrentRoleMonths).toBeNull();
    expect(r.uniqueEmployers).toBe(0);
    expect(r.careerGrownInternal.detected).toBe(false);
    expect(r.jobHopper.detected).toBe(false);
  });

  it('returns empty insights on empty array', () => {
    const r = analyzeApolloEmployment([]);
    expect(r.uniqueEmployers).toBe(0);
  });
});

describe('analyzeApolloEmployment — Aleksandar career-grown pattern', () => {
  const sysdig: ApolloEmploymentRow[] = [
    { organization_name: 'Sysdig', title: 'Director of Engineering', current: true, start_date: yearsAgo(0, 9) },
    { organization_name: 'Sysdig', title: 'Sr Engineering Manager', current: false, start_date: yearsAgo(2, 0), end_date: yearsAgo(0, 9) },
    { organization_name: 'Sysdig', title: 'Engineering Manager', current: false, start_date: yearsAgo(4, 0), end_date: yearsAgo(2, 0) },
    { organization_name: 'Sysdig', title: 'Software Engineer', current: false, start_date: yearsAgo(9, 0), end_date: yearsAgo(4, 0) }
  ];

  it('detects career-grown-internal at 8+ years with 2+ titles', () => {
    const r = analyzeApolloEmployment(sysdig);
    expect(r.careerGrownInternal.detected).toBe(true);
    expect(r.careerGrownInternal.employer).toBe('Sysdig');
    expect(r.careerGrownInternal.rolesCount).toBe(4);
    expect(r.careerGrownInternal.yearsAtEmployer).toBeGreaterThanOrEqual(8);
  });

  it('reports current employer + title', () => {
    const r = analyzeApolloEmployment(sysdig);
    expect(r.currentEmployer).toBe('Sysdig');
    expect(r.currentTitle).toBe('Director of Engineering');
    expect(r.rolesAtCurrentEmployer).toBe(4);
  });

  it('does not flag job-hopper (only 1 employer)', () => {
    const r = analyzeApolloEmployment(sysdig);
    expect(r.jobHopper.detected).toBe(false);
    expect(r.jobHopper.employersInLast5Years).toBe(1);
  });
});

describe('analyzeApolloEmployment — job-hopper detection', () => {
  it('detects 4+ employers started in last 5 years', () => {
    const rows: ApolloEmploymentRow[] = [
      { organization_name: 'Acme E', title: 'Director', current: true, start_date: yearsAgo(0, 6) },
      { organization_name: 'Acme D', title: 'Senior Manager', current: false, start_date: yearsAgo(1, 6), end_date: yearsAgo(0, 6) },
      { organization_name: 'Acme C', title: 'Manager', current: false, start_date: yearsAgo(2, 8), end_date: yearsAgo(1, 6) },
      { organization_name: 'Acme B', title: 'Lead', current: false, start_date: yearsAgo(3, 9), end_date: yearsAgo(2, 8) },
      { organization_name: 'Acme A', title: 'Engineer', current: false, start_date: yearsAgo(8, 0), end_date: yearsAgo(3, 9) }
    ];
    const r = analyzeApolloEmployment(rows);
    expect(r.jobHopper.detected).toBe(true);
    expect(r.jobHopper.employersInLast5Years).toBe(4);
  });

  it('does not flag job-hopper at 3 employers', () => {
    const rows: ApolloEmploymentRow[] = [
      { organization_name: 'Acme C', title: 'Director', current: true, start_date: yearsAgo(0, 8) },
      { organization_name: 'Acme B', title: 'Manager', current: false, start_date: yearsAgo(2, 0), end_date: yearsAgo(0, 8) },
      { organization_name: 'Acme A', title: 'Lead', current: false, start_date: yearsAgo(4, 0), end_date: yearsAgo(2, 0) }
    ];
    const r = analyzeApolloEmployment(rows);
    expect(r.jobHopper.detected).toBe(false);
  });
});

describe('analyzeApolloEmployment — tenure math', () => {
  it('computes tenure-at-current-role in months', () => {
    const rows: ApolloEmploymentRow[] = [
      { organization_name: 'Stripe', title: 'Senior SDET', current: true, start_date: yearsAgo(2, 6) }
    ];
    const r = analyzeApolloEmployment(rows);
    expect(r.tenureCurrentRoleMonths).toBeGreaterThan(28);
    expect(r.tenureCurrentRoleMonths).toBeLessThan(32);
  });

  it('computes tenure-at-current-employer continuously across role hops', () => {
    const rows: ApolloEmploymentRow[] = [
      { organization_name: 'Stripe', title: 'Senior SDET', current: true, start_date: yearsAgo(0, 6) },
      { organization_name: 'Stripe', title: 'SDET', current: false, start_date: yearsAgo(2, 6), end_date: yearsAgo(0, 6) },
      { organization_name: 'Stripe', title: 'QA Engineer', current: false, start_date: yearsAgo(4, 0), end_date: yearsAgo(2, 6) }
    ];
    const r = analyzeApolloEmployment(rows);
    expect(r.tenureCurrentEmployerMonths).toBeGreaterThan(45);
    expect(r.tenureCurrentEmployerMonths).toBeLessThan(50);
    expect(r.rolesAtCurrentEmployer).toBe(3);
  });

  it('handles year-only dates leniently', () => {
    const rows: ApolloEmploymentRow[] = [
      { organization_name: 'Acme', title: 'Director', current: true, start_date: '2020' }
    ];
    const r = analyzeApolloEmployment(rows);
    expect(r.tenureCurrentRoleMonths).toBeGreaterThan(0);
  });

  it('handles malformed dates without crashing', () => {
    const rows: ApolloEmploymentRow[] = [
      { organization_name: 'Acme', title: 'Director', current: true, start_date: 'invalid' }
    ];
    const r = analyzeApolloEmployment(rows);
    expect(r.tenureCurrentRoleMonths).toBeNull();
    expect(r.currentEmployer).toBe('Acme');
  });
});

describe('analyzeApolloEmployment — employer normalization', () => {
  it('treats "Microsoft Corp" + "Microsoft" as same employer', () => {
    const rows: ApolloEmploymentRow[] = [
      { organization_name: 'Microsoft', title: 'PM', current: true, start_date: yearsAgo(0, 6) },
      { organization_name: 'Microsoft Corp', title: 'PM Intern', current: false, start_date: yearsAgo(2, 0), end_date: yearsAgo(0, 6) }
    ];
    const r = analyzeApolloEmployment(rows);
    expect(r.uniqueEmployers).toBe(1);
    expect(r.rolesAtCurrentEmployer).toBe(2);
  });

  it('lists prev employers excluding current', () => {
    const rows: ApolloEmploymentRow[] = [
      { organization_name: 'Stripe', title: 'Sr SDET', current: true, start_date: yearsAgo(1, 0) },
      { organization_name: 'Square', title: 'SDET', current: false, start_date: yearsAgo(4, 0), end_date: yearsAgo(1, 0) },
      { organization_name: 'Cash App', title: 'Engineer', current: false, start_date: yearsAgo(6, 0), end_date: yearsAgo(4, 0) }
    ];
    const r = analyzeApolloEmployment(rows);
    expect(r.prevEmployers).toEqual(['Square', 'Cash App']);
  });
});

describe('insightsFromJson', () => {
  it('parses valid JSON', () => {
    const json = JSON.stringify([
      { organization_name: 'Acme', title: 'Director', current: true, start_date: yearsAgo(0, 6) }
    ]);
    const r = insightsFromJson(json);
    expect(r.currentEmployer).toBe('Acme');
  });

  it('returns empty on null / invalid JSON', () => {
    expect(insightsFromJson(null).uniqueEmployers).toBe(0);
    expect(insightsFromJson('not json').uniqueEmployers).toBe(0);
    expect(insightsFromJson('{"not": "an array"}').uniqueEmployers).toBe(0);
  });
});
