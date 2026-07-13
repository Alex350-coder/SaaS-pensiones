import type { Response } from 'supertest';

/**
 * E2E auth now travels in httpOnly cookies (docs/security.md A2): login and
 * refresh set `access_token` / `refresh_token` via `Set-Cookie` instead of the
 * response body. These helpers read those cookies so the specs can keep using
 * `Bearer <token>` (the guard accepts it as a programmatic-client fallback,
 * and the CSRF guard skips Bearer requests — no double-submit needed in tests).
 */
function cookieValue(res: Response, name: string): string {
  const raw = res.headers['set-cookie'] as unknown as string[] | undefined;
  const header = (raw ?? []).find((c) => c.startsWith(`${name}=`));
  const value = header?.split(';', 1)[0]?.split('=').slice(1).join('=');
  if (!value) {
    throw new Error(`Cookie "${name}" not found in Set-Cookie`);
  }
  return decodeURIComponent(value);
}

/** The access token a login/refresh response set as an httpOnly cookie. */
export function accessCookie(res: Response): string {
  return cookieValue(res, 'access_token');
}

/** The refresh token a login/refresh response set as an httpOnly cookie. */
export function refreshCookie(res: Response): string {
  return cookieValue(res, 'refresh_token');
}

/** The readable double-submit CSRF token set on login/refresh. */
export function csrfCookie(res: Response): string {
  return cookieValue(res, 'csrf_token');
}

/**
 * All auth cookies as a `Cookie` request-header array — replays a browser's
 * cookie jar so a spec can exercise the real cookie-based auth + CSRF path
 * (rather than the Bearer fallback).
 */
export function sessionCookies(res: Response): string[] {
  return [
    `access_token=${accessCookie(res)}`,
    `refresh_token=${refreshCookie(res)}`,
    `csrf_token=${csrfCookie(res)}`,
  ];
}
