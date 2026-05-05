// Tests for the API key health probes. Mocks `fetch` so we don't actually
// hit Anthropic or Apollo.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { checkAnthropicKey, checkApolloKey } from '../src/main/health/keyChecks';

const originalFetch = globalThis.fetch;
let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe('checkAnthropicKey', () => {
  it('returns not-configured when key is missing', async () => {
    const r = await checkAnthropicKey('');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('not-configured');
  });

  it('returns valid on 200', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({}) });
    const r = await checkAnthropicKey('sk-ant-test');
    expect(r.ok).toBe(true);
    expect(r.status).toBe('valid');
  });

  it('returns invalid on 401', async () => {
    fetchMock.mockResolvedValue({
      status: 401,
      json: async () => ({ error: { message: 'invalid x-api-key' } })
    });
    const r = await checkAnthropicKey('sk-ant-bad');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('invalid');
    expect(r.detail).toMatch(/invalid x-api-key/);
  });

  it('returns rate-limited on 429 (treated as ok=true since key valid)', async () => {
    fetchMock.mockResolvedValue({ status: 429, json: async () => ({}) });
    const r = await checkAnthropicKey('sk-ant-test');
    expect(r.ok).toBe(true);
    expect(r.status).toBe('rate-limited');
  });

  it('returns network-error on fetch throw', async () => {
    fetchMock.mockRejectedValue(new Error('ENOTFOUND'));
    const r = await checkAnthropicKey('sk-ant-test');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('network-error');
    expect(r.detail).toMatch(/ENOTFOUND/);
  });
});

describe('checkApolloKey', () => {
  it('returns not-configured when key is missing', async () => {
    const r = await checkApolloKey(null);
    expect(r.ok).toBe(false);
    expect(r.status).toBe('not-configured');
  });

  it('returns valid on 200 with is_logged_in=true', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ is_logged_in: true }) });
    const r = await checkApolloKey('apollo-test');
    expect(r.ok).toBe(true);
    expect(r.status).toBe('valid');
  });

  it('returns invalid on 200 with is_logged_in=false', async () => {
    fetchMock.mockResolvedValue({ status: 200, json: async () => ({ is_logged_in: false }) });
    const r = await checkApolloKey('apollo-test');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('invalid');
  });

  it('returns invalid on 401 / 403', async () => {
    fetchMock.mockResolvedValue({ status: 401, json: async () => ({}) });
    expect((await checkApolloKey('apollo-bad')).status).toBe('invalid');
    fetchMock.mockResolvedValue({ status: 403, json: async () => ({}) });
    expect((await checkApolloKey('apollo-bad')).status).toBe('invalid');
  });

  it('returns network-error on fetch throw', async () => {
    fetchMock.mockRejectedValue(new Error('connect ECONNREFUSED'));
    const r = await checkApolloKey('apollo-test');
    expect(r.ok).toBe(false);
    expect(r.status).toBe('network-error');
  });
});
