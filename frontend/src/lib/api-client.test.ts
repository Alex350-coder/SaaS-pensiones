import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError, apiFetch } from './api-client';
import { useSessionStore } from '@/stores/session-store';

/** Build a fake Response with a JSON body. */
function jsonRes(body: unknown, { ok = true, status = 200 } = {}) {
  return { ok, status, json: () => Promise.resolve(body) } as Response;
}
const ok = <T>(data: T) => jsonRes({ success: true, data, error: null });
const fail = (code: string, message: string, status: number, details?: unknown) =>
  jsonRes({ success: false, data: null, error: { code, message, details } }, { ok: false, status });

function authenticate() {
  useSessionStore.setState({
    user: { id: 'u1', email: 'a@b.com', fullName: 'A', role: 'CLIENT' } as never,
  });
}

function setCsrfCookie(value: string | null) {
  Object.defineProperty(document, 'cookie', {
    configurable: true,
    get: () => (value === null ? '' : `csrf_token=${value}`),
    set: () => undefined,
  });
}

describe('apiFetch', () => {
  beforeEach(() => {
    useSessionStore.setState({ user: null });
    setCsrfCookie(null);
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    useSessionStore.setState({ user: null });
  });

  it('unwraps the envelope data on success', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(ok({ id: '1' })));
    await expect(apiFetch('/x', { auth: false })).resolves.toEqual({ id: '1' });
  });

  it('always sends cookies (credentials: include) and prefixes the API base', async () => {
    authenticate();
    const fetchMock = vi.fn().mockResolvedValue(ok(null));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/auth/me');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('/api/v1/auth/me');
    expect(init.credentials).toBe('include');
    // No Authorization header: auth is cookie-based now.
    expect(init.headers.Authorization).toBeUndefined();
  });

  it('echoes the CSRF cookie in X-CSRF-Token on mutating requests', async () => {
    setCsrfCookie('csrf-abc');
    const fetchMock = vi.fn().mockResolvedValue(ok(null));
    vi.stubGlobal('fetch', fetchMock);

    await apiFetch('/x', { method: 'POST', body: { a: 1 }, auth: false });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['X-CSRF-Token']).toBe('csrf-abc');
  });

  it('does not add a CSRF header on safe (GET) requests', async () => {
    setCsrfCookie('csrf-abc');
    const fetchMock = vi.fn().mockResolvedValue(ok(null));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/restaurants', { auth: false });
    expect(fetchMock.mock.calls[0][1].headers['X-CSRF-Token']).toBeUndefined();
  });

  it('serializes a JSON body with the content-type header', async () => {
    const fetchMock = vi.fn().mockResolvedValue(ok(null));
    vi.stubGlobal('fetch', fetchMock);
    await apiFetch('/x', { method: 'POST', body: { a: 1 }, auth: false });
    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(init.body).toBe(JSON.stringify({ a: 1 }));
  });

  it('throws a typed ApiError carrying the code, status and details', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(fail('DISH_IN_USE', 'En uso.', 409, { x: 1 })));
    await expect(apiFetch('/x', { auth: false })).rejects.toMatchObject({
      code: 'DISH_IN_USE',
      message: 'En uso.',
      status: 409,
      details: { x: 1 },
    });
  });

  it('falls back to UNKNOWN_ERROR when the failure envelope has no error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(jsonRes({ success: false, data: null, error: null }, { ok: false, status: 500 })));
    await expect(apiFetch('/x', { auth: false })).rejects.toMatchObject({ code: 'UNKNOWN_ERROR' });
  });

  it('throws INVALID_RESPONSE when the body is not JSON', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      json: () => Promise.reject(new Error('bad json')),
    } as unknown as Response));
    await expect(apiFetch('/x', { auth: false })).rejects.toMatchObject({
      code: 'INVALID_RESPONSE',
      status: 502,
    });
  });

  it('maps a network failure to NETWORK_ERROR', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('offline')));
    await expect(apiFetch('/x', { auth: false })).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
      status: 0,
    });
  });

  it('re-throws an AbortError untouched', async () => {
    const abort = new DOMException('aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(abort));
    await expect(apiFetch('/x', { auth: false })).rejects.toBe(abort);
  });

  it('silently refreshes once on 401 then retries the original request', async () => {
    authenticate();
    const fetchMock = vi
      .fn()
      // 1. original request → 401
      .mockResolvedValueOnce(jsonRes({ success: false, data: null, error: { code: 'TOKEN_EXPIRED', message: 'x' } }, { ok: false, status: 401 }))
      // 2. POST /auth/refresh → 200 (cookies rotated server-side, no body needed)
      .mockResolvedValueOnce(jsonRes({ success: true, data: null, error: null }))
      // 3. retried request → success
      .mockResolvedValueOnce(ok({ id: 'after-refresh' }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/protected')).resolves.toEqual({ id: 'after-refresh' });
    expect(fetchMock.mock.calls[1][0]).toBe('/api/v1/auth/refresh');
    // Session still authenticated after the successful refresh.
    expect(useSessionStore.getState().user).not.toBeNull();
  });

  it('clears the session and surfaces the 401 when refresh fails', async () => {
    authenticate();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ success: false, data: null, error: { code: 'TOKEN_EXPIRED', message: 'Sesión expirada.' } }, { ok: false, status: 401 }))
      // refresh rejected by the server
      .mockResolvedValueOnce(jsonRes({ success: false, data: null, error: { code: 'INVALID_REFRESH', message: 'x' } }, { ok: false, status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/protected')).rejects.toBeInstanceOf(ApiError);
    expect(useSessionStore.getState().user).toBeNull();
  });

  it('does not attempt a refresh when there is no local session', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonRes({ success: false, data: null, error: { code: 'MISSING_ACCESS_TOKEN', message: 'x' } }, { ok: false, status: 401 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiFetch('/protected')).rejects.toBeInstanceOf(ApiError);
    // Only the original call — no /auth/refresh round-trip.
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
