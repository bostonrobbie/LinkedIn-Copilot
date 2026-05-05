// Watchdog for Playwright operations. Wraps each long-running call with a
// hard timeout so a stuck page.goto / fill / click can't halt the agent forever.
//
// Usage:
//   const result = await withWatchdog('capture-profile', 60_000, () => capturePublicProfile(...));
//
// On timeout the inner promise is allowed to keep running (we can't safely
// cancel arbitrary Playwright state mid-flight), but the outer caller gets
// a clear `WatchdogTimeout` error and can recover (close the page, retry, etc.).

import log from 'electron-log';

export class WatchdogTimeout extends Error {
  constructor(public label: string, public ms: number) {
    super(`watchdog: ${label} exceeded ${ms}ms`);
    this.name = 'WatchdogTimeout';
  }
}

export interface WatchdogOptions {
  onTimeout?: () => void | Promise<void>;
}

export async function withWatchdog<T>(
  label: string,
  timeoutMs: number,
  fn: () => Promise<T>,
  opts?: WatchdogOptions
): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  let timedOut = false;

  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      timedOut = true;
      log.warn(`watchdog: ${label} timed out after ${timeoutMs}ms`);
      Promise.resolve()
        .then(() => opts?.onTimeout?.())
        .catch((err) => log.warn(`watchdog: ${label} onTimeout failed`, err))
        .finally(() => reject(new WatchdogTimeout(label, timeoutMs)));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([fn(), timeoutPromise]);
    return result;
  } finally {
    if (timer) clearTimeout(timer);
    if (timedOut) {
      // Drain the original promise so unhandled rejections don't leak.
      // It's fire-and-forget — caller has already given up.
    }
  }
}

// Sensible defaults per operation.
export const WATCHDOG = {
  PROFILE_CAPTURE_MS: 90_000,    // page.goto + extraction can be slow on first load
  CONNECT_SEND_MS: 60_000,       // navigate + connect modal + readback + send
  INMAIL_SEND_MS: 90_000,        // includes Sales Nav search + lead page + composer
  LOGIN_CHECK_MS: 30_000,        // navigate to /feed/ + check
  REPLY_SYNC_MS: 90_000           // invitation manager + inbox scan
};
