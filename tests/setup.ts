// Vitest setup — mocks Electron + electron-log + better-sqlite3 so we can test
// pure agent code without launching Electron.

import { vi } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: () => '/tmp/linkedin-copilot-test' },
  ipcMain: { handle: vi.fn() },
  BrowserWindow: vi.fn()
}));

vi.mock('electron-log', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), transports: { file: { level: 'info' } } }
}));

// In-memory SQLite stub. Most tests don't actually touch the DB; the few that do
// can override with their own mock.
vi.mock('better-sqlite3', () => {
  const Database = vi.fn(() => ({
    pragma: vi.fn(),
    prepare: vi.fn(() => ({
      run: vi.fn(() => ({ changes: 0, lastInsertRowid: 0 })),
      get: vi.fn(() => undefined),
      all: vi.fn(() => [])
    })),
    exec: vi.fn(),
    transaction: vi.fn((fn: () => unknown) => fn),
    close: vi.fn()
  }));
  return { default: Database };
});
