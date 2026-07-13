import { randomBytes } from 'node:crypto';
import type { CookieOptions, Request, Response } from 'express';
import type { AppConfigService } from '../config/app-config.service';
import type { TokenPair } from '../../modules/identity/application/auth.service';

/**
 * Auth cookie contract (docs/security.md A2/A8). Tokens live in httpOnly
 * cookies so no browser script can read them (closes code-review C-1); a
 * separate readable `csrf_token` powers double-submit CSRF protection.
 *
 * This module is the single source of truth for cookie names and attributes —
 * the controller sets/clears them, the guards read them, nothing inlines a
 * cookie option elsewhere (DRY).
 */
export const ACCESS_TOKEN_COOKIE = 'access_token';
export const REFRESH_TOKEN_COOKIE = 'refresh_token';
export const CSRF_TOKEN_COOKIE = 'csrf_token';
export const CSRF_HEADER = 'x-csrf-token';

/** Refresh + logout live under this prefix; scope the refresh cookie to it. */
const AUTH_PATH = '/api/v1/auth';
// The CSRF token must be readable by the SPA at any route (`document.cookie`
// only exposes cookies whose path prefixes the current page), so it is
// root-scoped — unlike the httpOnly token cookies, which JS never reads.
const ROOT_PATH = '/';
const MS_PER_DAY = 86_400_000;

interface RequestCookies {
  [ACCESS_TOKEN_COOKIE]?: string;
  [REFRESH_TOKEN_COOKIE]?: string;
  [CSRF_TOKEN_COOKIE]?: string;
}

function cookies(req: Request): RequestCookies {
  return (req as Request & { cookies?: RequestCookies }).cookies ?? {};
}

export function readAccessTokenCookie(req: Request): string | undefined {
  return cookies(req)[ACCESS_TOKEN_COOKIE];
}

export function readRefreshTokenCookie(req: Request): string | undefined {
  return cookies(req)[REFRESH_TOKEN_COOKIE];
}

export function readCsrfCookie(req: Request): string | undefined {
  return cookies(req)[CSRF_TOKEN_COOKIE];
}

export function readCsrfHeader(req: Request): string | undefined {
  const value = req.headers[CSRF_HEADER];
  return typeof value === 'string' ? value : undefined;
}

function baseOptions(config: AppConfigService): CookieOptions {
  return {
    secure: config.cookieSecure,
    domain: config.cookieDomain,
  };
}

/**
 * Set the three auth cookies after login/register/refresh. Returns the CSRF
 * token so callers can log/trace if needed (never required by the client —
 * it reads the cookie directly).
 */
export function setAuthCookies(
  res: Response,
  config: AppConfigService,
  tokens: TokenPair,
): void {
  const base = baseOptions(config);
  const accessMaxAge = config.jwtAccessTtlSeconds * 1000;
  const refreshMaxAge = config.refreshTokenTtlDays * MS_PER_DAY;

  // Root-scoped so it also rides the same-origin Socket.IO handshake
  // (`/socket.io`, outside `/api/v1`); httpOnly keeps it unreadable by JS.
  res.cookie(ACCESS_TOKEN_COOKIE, tokens.accessToken, {
    ...base,
    httpOnly: true,
    sameSite: 'lax',
    path: ROOT_PATH,
    maxAge: accessMaxAge,
  });

  res.cookie(REFRESH_TOKEN_COOKIE, tokens.refreshToken, {
    ...base,
    httpOnly: true,
    sameSite: 'strict',
    path: AUTH_PATH,
    maxAge: refreshMaxAge,
  });

  // Readable by the SPA (not httpOnly) so it can echo the value in the
  // X-CSRF-Token header; the guard checks header === cookie (double-submit).
  res.cookie(CSRF_TOKEN_COOKIE, randomBytes(32).toString('hex'), {
    ...base,
    httpOnly: false,
    sameSite: 'lax',
    path: ROOT_PATH,
    maxAge: refreshMaxAge,
  });
}

/** Clear all auth cookies on logout (attributes must match to delete). */
export function clearAuthCookies(res: Response, config: AppConfigService): void {
  const base = baseOptions(config);
  res.clearCookie(ACCESS_TOKEN_COOKIE, { ...base, path: ROOT_PATH });
  res.clearCookie(REFRESH_TOKEN_COOKIE, { ...base, path: AUTH_PATH });
  res.clearCookie(CSRF_TOKEN_COOKIE, { ...base, path: ROOT_PATH });
}
