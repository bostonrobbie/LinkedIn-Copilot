// Tests for the safeStorage wrapper. The Electron `safeStorage` module is
// mocked via tests/setup.ts; the real implementation is exercised on
// production launch.

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Provide an explicit mock for the safeStorage path so we can flip
// isEncryptionAvailable per test.
let mockEncryptionAvailable = true;
const encryptString = vi.fn((s: string) => Buffer.from('ENC:' + s));
const decryptString = vi.fn((b: Buffer) => {
  const s = b.toString('utf8');
  if (s.startsWith('ENC:')) return s.slice(4);
  throw new Error('not an encrypted blob');
});

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/linkedin-copilot-test' },
  ipcMain: { handle: vi.fn() },
  BrowserWindow: vi.fn(),
  safeStorage: {
    isEncryptionAvailable: () => mockEncryptionAvailable,
    encryptString,
    decryptString
  }
}));

describe('secrets — safeStorage encryption available', () => {
  beforeEach(() => {
    mockEncryptionAvailable = true;
    encryptString.mockClear();
    decryptString.mockClear();
    vi.resetModules();
  });

  it('encryptKey returns a Buffer when string is non-empty', async () => {
    const { encryptKey } = await import('../src/main/secrets');
    const out = encryptKey('sk-ant-test-1234');
    expect(out).toBeInstanceOf(Buffer);
    expect(encryptString).toHaveBeenCalledWith('sk-ant-test-1234');
  });

  it('encryptKey returns null for empty/null/undefined', async () => {
    const { encryptKey } = await import('../src/main/secrets');
    expect(encryptKey(null)).toBeNull();
    expect(encryptKey('')).toBeNull();
    expect(encryptKey(undefined)).toBeNull();
  });

  it('decryptKey round-trips the value', async () => {
    const { encryptKey, decryptKey } = await import('../src/main/secrets');
    const enc = encryptKey('sk-ant-roundtrip');
    const dec = decryptKey(enc);
    expect(dec).toBe('sk-ant-roundtrip');
  });

  it('decryptKey returns null for null buffer', async () => {
    const { decryptKey } = await import('../src/main/secrets');
    expect(decryptKey(null)).toBeNull();
  });
});

describe('secrets — safeStorage unavailable (dev/headless)', () => {
  beforeEach(() => {
    mockEncryptionAvailable = false;
    vi.resetModules();
  });

  it('encryptKey falls back to PLAIN: prefixed buffer', async () => {
    const { encryptKey } = await import('../src/main/secrets');
    const buf = encryptKey('sk-fallback');
    expect(buf).toBeInstanceOf(Buffer);
    expect(buf!.subarray(0, 6).toString('utf8')).toBe('PLAIN:');
    expect(buf!.subarray(6).toString('utf8')).toBe('sk-fallback');
  });

  it('decryptKey unwraps PLAIN: prefixed buffer even when encryption unavailable', async () => {
    const { encryptKey, decryptKey } = await import('../src/main/secrets');
    const enc = encryptKey('sk-fallback');
    const dec = decryptKey(enc);
    expect(dec).toBe('sk-fallback');
  });
});
