// Tests for the Playwright watchdog wrapper.

import { describe, it, expect, vi } from 'vitest';
import { withWatchdog, WatchdogTimeout, WATCHDOG } from '../src/main/browser/watchdog';

describe('withWatchdog', () => {
  it('resolves the inner promise normally when fast', async () => {
    const r = await withWatchdog('fast', 1000, async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
      return 'ok';
    });
    expect(r).toBe('ok');
  });

  it('throws WatchdogTimeout when inner promise exceeds limit', async () => {
    const start = Date.now();
    await expect(
      withWatchdog('slow', 50, async () => {
        await new Promise((resolve) => setTimeout(resolve, 500));
        return 'never';
      })
    ).rejects.toBeInstanceOf(WatchdogTimeout);
    const elapsed = Date.now() - start;
    expect(elapsed).toBeLessThan(400);
  });

  it('preserves inner errors on rejection', async () => {
    await expect(
      withWatchdog('boom', 1000, async () => {
        throw new Error('inner failure');
      })
    ).rejects.toThrow('inner failure');
  });

  it('calls onTimeout when watchdog fires', async () => {
    const onTimeout = vi.fn().mockResolvedValue(undefined);
    await expect(
      withWatchdog('with-cleanup', 30, async () => {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }, { onTimeout })
    ).rejects.toBeInstanceOf(WatchdogTimeout);
    expect(onTimeout).toHaveBeenCalledOnce();
  });

  it('WatchdogTimeout exposes label + ms', async () => {
    try {
      await withWatchdog('label-test', 10, () => new Promise(() => { /* never */ }));
    } catch (e) {
      const w = e as WatchdogTimeout;
      expect(w.label).toBe('label-test');
      expect(w.ms).toBe(10);
      expect(w.name).toBe('WatchdogTimeout');
    }
  });
});

describe('WATCHDOG defaults', () => {
  it('exposes sensible per-operation defaults', () => {
    expect(WATCHDOG.PROFILE_CAPTURE_MS).toBeGreaterThanOrEqual(60_000);
    expect(WATCHDOG.CONNECT_SEND_MS).toBeGreaterThanOrEqual(30_000);
    expect(WATCHDOG.INMAIL_SEND_MS).toBeGreaterThanOrEqual(60_000);
    expect(WATCHDOG.LOGIN_CHECK_MS).toBeGreaterThanOrEqual(15_000);
    expect(WATCHDOG.REPLY_SYNC_MS).toBeGreaterThanOrEqual(60_000);
  });
});
