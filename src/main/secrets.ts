// API key encryption at rest using Electron safeStorage (OS keychain backed).
// safeStorage is unavailable on headless Linux without dbus/keyring; falls
// back gracefully to a no-encryption mode with a warning so dev environments
// keep working. On macOS / Windows it's transparent.

import { safeStorage } from 'electron';
import log from 'electron-log';

let encryptionAvailable: boolean | null = null;

export function isEncryptionAvailable(): boolean {
  if (encryptionAvailable !== null) return encryptionAvailable;
  try {
    encryptionAvailable = safeStorage.isEncryptionAvailable();
    if (!encryptionAvailable) {
      log.warn('safeStorage encryption unavailable — keys stored plaintext (dev/headless env)');
    }
  } catch (err) {
    log.warn('safeStorage check failed', err);
    encryptionAvailable = false;
  }
  return encryptionAvailable;
}

export function encryptKey(plaintext: string | null | undefined): Buffer | null {
  if (!plaintext) return null;
  if (!isEncryptionAvailable()) {
    // Fallback: store as bytes with a sentinel prefix so the decrypt path knows.
    return Buffer.concat([Buffer.from('PLAIN:'), Buffer.from(plaintext, 'utf8')]);
  }
  try {
    return safeStorage.encryptString(plaintext);
  } catch (err) {
    log.error('safeStorage.encryptString failed', err);
    return null;
  }
}

export function decryptKey(buf: Buffer | Uint8Array | null | undefined): string | null {
  if (!buf) return null;
  const b = Buffer.isBuffer(buf) ? buf : Buffer.from(buf);
  // Sentinel for plaintext-fallback storage.
  if (b.length >= 6 && b.subarray(0, 6).toString('utf8') === 'PLAIN:') {
    return b.subarray(6).toString('utf8');
  }
  if (!isEncryptionAvailable()) {
    log.warn('decryptKey called but encryption unavailable; returning null');
    return null;
  }
  try {
    return safeStorage.decryptString(b);
  } catch (err) {
    log.error('safeStorage.decryptString failed', err);
    return null;
  }
}
