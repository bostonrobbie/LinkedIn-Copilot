// Onboarding step persistence. Replaces the localStorage flag with a per-user,
// per-step row in the DB so reinstalls / multi-rep correctly re-prompt.

import { getDb } from './db/client';

export const STEPS = [
  'welcome',
  'linkedin',
  'salesnav',
  'anthropic',
  'apollo',
  'tam',
  'demo',
  'done'
] as const;

export type StepId = typeof STEPS[number];
export type StepStatus = 'pending' | 'completed' | 'skipped';

export interface StepRow {
  step_id: StepId;
  status: StepStatus;
  completed_at: string | null;
  meta: Record<string, unknown> | null;
}

export function getStepStates(userId: number): StepRow[] {
  const conn = getDb();
  const rows = conn
    .prepare("SELECT step_id, status, completed_at, meta FROM onboarding_steps WHERE user_id = ?")
    .all(userId) as Array<{ step_id: string; status: string; completed_at: string | null; meta: string | null }>;
  const byId = new Map(rows.map((r) => [r.step_id, r]));
  return STEPS.map((id) => {
    const row = byId.get(id);
    return {
      step_id: id,
      status: ((row?.status ?? 'pending') as StepStatus),
      completed_at: row?.completed_at ?? null,
      meta: row?.meta ? JSON.parse(row.meta) : null
    };
  });
}

export function setStepStatus(userId: number, stepId: StepId, status: StepStatus, meta?: Record<string, unknown>): void {
  const completed = status === 'completed' ? "datetime('now')" : null;
  const completedExpr = completed ? completed : 'NULL';
  getDb()
    .prepare(
      `INSERT INTO onboarding_steps (user_id, step_id, status, completed_at, meta)
       VALUES (?, ?, ?, ${completedExpr}, ?)
       ON CONFLICT(user_id, step_id) DO UPDATE SET
         status = excluded.status,
         completed_at = excluded.completed_at,
         meta = excluded.meta`
    )
    .run(userId, stepId, status, meta ? JSON.stringify(meta) : null);
}

export function resetOnboarding(userId: number): void {
  getDb().prepare('DELETE FROM onboarding_steps WHERE user_id = ?').run(userId);
}

export function isOnboardingComplete(userId: number): boolean {
  const rows = getStepStates(userId);
  return rows.find((r) => r.step_id === 'done')?.status === 'completed';
}
