import type { Response } from 'express';
import type { AppConfigService } from '../config/app-config.service';
import {
  ACCESS_TOKEN_COOKIE,
  CSRF_TOKEN_COOKIE,
  REFRESH_TOKEN_COOKIE,
  clearAuthCookies,
  readAccessTokenCookie,
  readRefreshTokenCookie,
  setAuthCookies,
} from './cookies';

function fakeConfig(overrides: Partial<AppConfigService> = {}): AppConfigService {
  return {
    jwtAccessTtlSeconds: 900,
    refreshTokenTtlDays: 7,
    cookieSecure: true,
    cookieDomain: undefined,
    ...overrides,
  } as AppConfigService;
}

interface SetCall {
  name: string;
  value: string;
  options: Record<string, unknown>;
}

function fakeResponse(): { res: Response; sets: SetCall[]; clears: string[] } {
  const sets: SetCall[] = [];
  const clears: string[] = [];
  const res = {
    cookie: (name: string, value: string, options: Record<string, unknown>) => {
      sets.push({ name, value, options });
      return res;
    },
    clearCookie: (name: string) => {
      clears.push(name);
      return res;
    },
  } as unknown as Response;
  return { res, sets, clears };
}

describe('auth cookies', () => {
  it('sets access (httpOnly), refresh (strict, scoped) and readable csrf', () => {
    const { res, sets } = fakeResponse();
    setAuthCookies(res, fakeConfig(), {
      accessToken: 'access',
      refreshToken: 'refresh',
    });

    const access = sets.find((c) => c.name === ACCESS_TOKEN_COOKIE);
    const refresh = sets.find((c) => c.name === REFRESH_TOKEN_COOKIE);
    const csrf = sets.find((c) => c.name === CSRF_TOKEN_COOKIE);

    expect(access?.options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
    });
    expect(refresh?.options).toMatchObject({
      httpOnly: true,
      sameSite: 'strict',
      path: '/api/v1/auth',
    });
    // CSRF token must be readable by the SPA (not httpOnly) and non-empty.
    expect(csrf?.options.httpOnly).toBe(false);
    expect((csrf?.value ?? '').length).toBeGreaterThan(16);
  });

  it('clears all three auth cookies', () => {
    const { res, clears } = fakeResponse();
    clearAuthCookies(res, fakeConfig());
    expect(clears).toEqual(
      expect.arrayContaining([
        ACCESS_TOKEN_COOKIE,
        REFRESH_TOKEN_COOKIE,
        CSRF_TOKEN_COOKIE,
      ]),
    );
  });

  it('reads tokens back from the parsed request cookies', () => {
    const req = {
      cookies: { [ACCESS_TOKEN_COOKIE]: 'a', [REFRESH_TOKEN_COOKIE]: 'r' },
    } as unknown as import('express').Request;
    expect(readAccessTokenCookie(req)).toBe('a');
    expect(readRefreshTokenCookie(req)).toBe('r');
  });

  it('returns undefined when cookies are absent', () => {
    const req = {} as import('express').Request;
    expect(readAccessTokenCookie(req)).toBeUndefined();
    expect(readRefreshTokenCookie(req)).toBeUndefined();
  });
});
