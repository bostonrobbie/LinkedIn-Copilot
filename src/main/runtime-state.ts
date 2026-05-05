// In-memory state for "have we recently observed LinkedIn / Sales Nav as logged in?"
// Each surface tracks its own state — they expire independently in production.
// The header banner reads this; the orchestrator updates it on capture/send.

export type SessionState = 'unknown' | 'logged-in' | 'logged-out' | 'error';

interface RuntimeSurface {
  state: SessionState;
  lastObservedAt: string | null;
}

const linkedin: RuntimeSurface = { state: 'unknown', lastObservedAt: null };
const salesnav: RuntimeSurface = { state: 'unknown', lastObservedAt: null };

function setSurface(surface: RuntimeSurface, s: SessionState): void {
  surface.state = s;
  surface.lastObservedAt = new Date().toISOString();
}

export function setLinkedInState(s: SessionState): void {
  setSurface(linkedin, s);
}
export function getLinkedInState(): RuntimeSurface {
  return { ...linkedin };
}

export function setSalesNavState(s: SessionState): void {
  setSurface(salesnav, s);
}
export function getSalesNavState(): RuntimeSurface {
  return { ...salesnav };
}
