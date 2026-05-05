// Tests for the log-tail line parser.

import { describe, it, expect } from 'vitest';

// LINE_RE is internal to logTail.ts. We test the regex directly to keep parity.
const LINE_RE = /^\[(?<ts>[^\]]+)\]\s*\[(?<level>[^\]]+)\]\s*(?<text>.*)$/;

describe('log line parsing', () => {
  it('matches electron-log default format', () => {
    const line = '[2026-05-04 21:30:01.123] [info]  schema initialized';
    const m = line.match(LINE_RE);
    expect(m?.groups?.ts).toBe('2026-05-04 21:30:01.123');
    expect(m?.groups?.level).toBe('info');
    expect(m?.groups?.text).toContain('schema initialized');
  });

  it('matches warn level', () => {
    const m = '[2026-05-04 21:30:01.123] [warn]  send_queue tick failed'.match(LINE_RE);
    expect(m?.groups?.level).toBe('warn');
  });

  it('matches error level', () => {
    const m = '[2026-05-04 21:30:01.123] [error] backup:create failed'.match(LINE_RE);
    expect(m?.groups?.level).toBe('error');
  });

  it('returns null on non-matching line (will be kept as raw text)', () => {
    expect('not a log line'.match(LINE_RE)).toBeNull();
    expect(''.match(LINE_RE)).toBeNull();
  });

  it('handles colons inside the text body', () => {
    const m = '[2026-05-04 21:30:01.123] [info]  llm: qa-score rate limited — retry in 4s'.match(LINE_RE);
    expect(m?.groups?.text).toBe('llm: qa-score rate limited — retry in 4s');
  });
});
