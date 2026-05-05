// Cheap health probes for the Anthropic + Apollo API keys. Used by Settings
// and Onboarding so the user knows immediately if they pasted a typo.
//
// Anthropic: send a 1-token completion (cheapest possible call) and check
//            for 401 / 200. Don't actually use the response.
// Apollo:    GET /v1/auth/health — returns {is_logged_in: true} on a valid key.

import log from 'electron-log';

export interface KeyHealthResult {
  ok: boolean;
  status: 'valid' | 'invalid' | 'rate-limited' | 'network-error' | 'not-configured';
  detail: string;
  httpStatus?: number;
}

export async function checkAnthropicKey(apiKey: string | null | undefined): Promise<KeyHealthResult> {
  if (!apiKey) return { ok: false, status: 'not-configured', detail: 'no key set' };
  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'ok' }]
      })
    });
    if (resp.status === 200) {
      return { ok: true, status: 'valid', detail: 'reachable, key accepted', httpStatus: 200 };
    }
    if (resp.status === 401) {
      const body = (await resp.json().catch(() => ({}))) as { error?: { message?: string } };
      return {
        ok: false,
        status: 'invalid',
        detail: body.error?.message ?? 'Anthropic returned 401 — key rejected',
        httpStatus: 401
      };
    }
    if (resp.status === 429) {
      return { ok: true, status: 'rate-limited', detail: 'Anthropic rate-limited the probe (key likely valid; surface to user)', httpStatus: 429 };
    }
    return { ok: false, status: 'invalid', detail: `Anthropic HTTP ${resp.status}`, httpStatus: resp.status };
  } catch (err) {
    log.warn('checkAnthropicKey network error', err);
    return { ok: false, status: 'network-error', detail: err instanceof Error ? err.message : String(err) };
  }
}

export async function checkApolloKey(apiKey: string | null | undefined): Promise<KeyHealthResult> {
  if (!apiKey) return { ok: false, status: 'not-configured', detail: 'no key set' };
  try {
    const resp = await fetch('https://api.apollo.io/v1/auth/health', {
      method: 'GET',
      headers: {
        'Cache-Control': 'no-cache',
        'X-Api-Key': apiKey
      }
    });
    if (resp.status === 200) {
      const body = (await resp.json().catch(() => ({}))) as { is_logged_in?: boolean };
      if (body.is_logged_in === true) {
        return { ok: true, status: 'valid', detail: 'Apollo auth healthy', httpStatus: 200 };
      }
      return { ok: false, status: 'invalid', detail: 'Apollo /auth/health returned is_logged_in=false', httpStatus: 200 };
    }
    if (resp.status === 401 || resp.status === 403) {
      return { ok: false, status: 'invalid', detail: `Apollo ${resp.status} — key rejected`, httpStatus: resp.status };
    }
    if (resp.status === 429) {
      return { ok: true, status: 'rate-limited', detail: 'Apollo rate-limited the probe', httpStatus: 429 };
    }
    return { ok: false, status: 'invalid', detail: `Apollo HTTP ${resp.status}`, httpStatus: resp.status };
  } catch (err) {
    log.warn('checkApolloKey network error', err);
    return { ok: false, status: 'network-error', detail: err instanceof Error ? err.message : String(err) };
  }
}
