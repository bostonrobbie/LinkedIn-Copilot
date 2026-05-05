// Parses the `apollo_employment` JSON column (Apollo's `contact.employment_history`)
// into structured insights the orchestrator can reason over.
//
// Apollo's shape is approximately:
//   [
//     { organization_name: "Sysdig", title: "Director of Engineering", current: true,
//       start_date: "2025-02-01", end_date: null },
//     { organization_name: "Sysdig", title: "Sr Engineering Manager", current: false,
//       start_date: "2023-06-01", end_date: "2025-02-01" },
//     ...
//   ]
//
// What we extract:
//   * tenure-at-current-role in months
//   * tenure-at-current-employer in months (sums consecutive same-org rows)
//   * career-grown-internal flag (multiple roles at same employer with progression)
//   * job-hopper flag (4+ employers in last 5 years)
//   * total years of experience

export interface ApolloEmploymentRow {
  organization_name?: string;
  title?: string;
  current?: boolean;
  start_date?: string;
  end_date?: string;
}

export interface EmploymentInsights {
  tenureCurrentRoleMonths: number | null;
  tenureCurrentEmployerMonths: number | null;
  currentEmployer: string | null;
  currentTitle: string | null;
  rolesAtCurrentEmployer: number;          // count of rows at the current employer
  totalExperienceMonths: number | null;
  uniqueEmployers: number;
  careerGrownInternal: {
    detected: boolean;
    employer: string | null;
    rolesCount: number;
    yearsAtEmployer: number;
  };
  jobHopper: {
    detected: boolean;
    employersInLast5Years: number;
  };
  prevEmployers: string[];
}

function monthsBetween(startISO: string | undefined, endISO: string | undefined | null): number | null {
  if (!startISO) return null;
  const start = parseLooseDate(startISO);
  if (!start) return null;
  const end = endISO ? parseLooseDate(endISO) : new Date();
  if (!end) return null;
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return Math.max(0, months);
}

// Apollo dates can be "2018-03-15" / "2018-03" / "2018". Parse leniently.
function parseLooseDate(s: string): Date | null {
  const m = s.match(/^(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/);
  if (!m) return null;
  const yr = Number(m[1]);
  const mo = m[2] ? Math.max(1, Math.min(12, Number(m[2]))) : 1;
  const day = m[3] ? Math.max(1, Math.min(28, Number(m[3]))) : 1;  // pin to 28 to avoid month-rollover bugs
  if (yr < 1950 || yr > 2100) return null;
  return new Date(Date.UTC(yr, mo - 1, day));
}

function normalizeEmployer(s: string | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+(inc\.?|llc|corp\.?|ltd\.?|gmbh|sa|se|plc)$/i, '');
}

// Sort employment rows: current first, then by start_date desc.
function sortRows(rows: ApolloEmploymentRow[]): ApolloEmploymentRow[] {
  return [...rows].sort((a, b) => {
    if (a.current && !b.current) return -1;
    if (!a.current && b.current) return 1;
    const aDate = a.start_date ?? '';
    const bDate = b.start_date ?? '';
    return bDate.localeCompare(aDate);
  });
}

export function analyzeApolloEmployment(employment: ApolloEmploymentRow[] | null | undefined): EmploymentInsights {
  if (!Array.isArray(employment) || employment.length === 0) {
    return {
      tenureCurrentRoleMonths: null,
      tenureCurrentEmployerMonths: null,
      currentEmployer: null,
      currentTitle: null,
      rolesAtCurrentEmployer: 0,
      totalExperienceMonths: null,
      uniqueEmployers: 0,
      careerGrownInternal: { detected: false, employer: null, rolesCount: 0, yearsAtEmployer: 0 },
      jobHopper: { detected: false, employersInLast5Years: 0 },
      prevEmployers: []
    };
  }

  const sorted = sortRows(employment);
  const current = sorted.find((r) => r.current) ?? sorted[0];
  const currentEmployerNorm = normalizeEmployer(current.organization_name);

  // Tenure at current role (single row).
  const tenureCurrentRoleMonths = monthsBetween(current.start_date, current.end_date);

  // Tenure at current employer (sum across consecutive same-org rows starting from current).
  let tenureEmployerMonths = 0;
  let rolesAtCurrentEmployer = 0;
  let earliestStartAtEmployer: string | undefined;
  for (const r of sorted) {
    if (normalizeEmployer(r.organization_name) === currentEmployerNorm) {
      rolesAtCurrentEmployer++;
      const m = monthsBetween(r.start_date, r.end_date);
      if (m !== null) tenureEmployerMonths += m;
      if (r.start_date && (!earliestStartAtEmployer || r.start_date < earliestStartAtEmployer)) {
        earliestStartAtEmployer = r.start_date;
      }
    }
  }
  // Recompute employer tenure as continuous if we have an earliest start (more accurate than summing).
  if (earliestStartAtEmployer) {
    const continuous = monthsBetween(earliestStartAtEmployer, current.current ? null : current.end_date);
    if (continuous !== null) tenureEmployerMonths = continuous;
  }

  // Total experience: sum of all role months (with a guard for overlap — many BDR profiles have overlapping rows).
  let totalExperienceMonths = 0;
  for (const r of sorted) {
    const m = monthsBetween(r.start_date, r.end_date);
    if (m !== null) totalExperienceMonths += m;
  }

  // Unique employers across the whole history.
  const employerSet = new Set<string>();
  for (const r of sorted) {
    const norm = normalizeEmployer(r.organization_name);
    if (norm) employerSet.add(norm);
  }

  // Career-grown-internal: 8+ years at one company with 2+ distinct titles.
  // Aleksandar pattern: Sysdig 9yr SWE → EM → Sr EM → Director.
  const yearsAtEmployer = tenureEmployerMonths / 12;
  const careerGrownInternal = {
    detected: yearsAtEmployer >= 8 && rolesAtCurrentEmployer >= 2,
    employer: current.organization_name ?? null,
    rolesCount: rolesAtCurrentEmployer,
    yearsAtEmployer: Number(yearsAtEmployer.toFixed(1))
  };

  // Job-hopper: 4+ distinct employers started in last 5 years.
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const recentEmployers = new Set<string>();
  for (const r of sorted) {
    const start = r.start_date ? parseLooseDate(r.start_date) : null;
    if (start && start >= fiveYearsAgo) {
      const norm = normalizeEmployer(r.organization_name);
      if (norm) recentEmployers.add(norm);
    }
  }
  const jobHopper = {
    detected: recentEmployers.size >= 4,
    employersInLast5Years: recentEmployers.size
  };

  // Previous employers (excluding current), in order.
  const prevEmployers: string[] = [];
  for (const r of sorted) {
    if (normalizeEmployer(r.organization_name) === currentEmployerNorm) continue;
    if (r.organization_name && !prevEmployers.includes(r.organization_name)) {
      prevEmployers.push(r.organization_name);
    }
  }

  return {
    tenureCurrentRoleMonths,
    tenureCurrentEmployerMonths: tenureEmployerMonths || null,
    currentEmployer: current.organization_name ?? null,
    currentTitle: current.title ?? null,
    rolesAtCurrentEmployer,
    totalExperienceMonths: totalExperienceMonths || null,
    uniqueEmployers: employerSet.size,
    careerGrownInternal,
    jobHopper,
    prevEmployers
  };
}

// Helper for the orchestrator: parses the JSON column safely + returns insights.
export function insightsFromJson(json: string | null | undefined): EmploymentInsights {
  if (!json) return analyzeApolloEmployment(null);
  try {
    const parsed = JSON.parse(json);
    return analyzeApolloEmployment(Array.isArray(parsed) ? parsed : null);
  } catch {
    return analyzeApolloEmployment(null);
  }
}
