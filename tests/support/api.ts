/**
 * API helpers for self-contained, re-runnable E2E setup.
 *
 * Some critical flows mutate state that can only happen once per actor (a client
 * may hold only one live pension; a restaurant is approved exactly once). Those
 * specs provision a FRESH actor through the API so every run starts clean:
 *   - a brand-new CLIENT to exercise "contratar pensión",
 *   - a brand-new RESTAURANT_ADMIN + PENDING restaurant to exercise approval.
 *
 * The register endpoint returns a full session, so provisioned actors never
 * spend a login request (the API rate-limits register 3/min and login 5/min).
 */
import { readFileSync } from 'node:fs';
import { APIRequestContext, APIResponse, expect } from '@playwright/test';
import { API_BASE, DEMO_PASSWORD } from './data';

export interface Session {
  user: { id: string; email: string; fullName: string; role: string };
  // Parsed from the auth cookies the server sets (docs/security.md A2). Kept on
  // the session object so specs can send `Bearer <token>` (a programmatic-client
  // fallback the guard accepts, and which skips the CSRF double-submit).
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

/** Unwrap the `{ success, data, error }` envelope, asserting success. */
async function unwrap<T>(res: APIResponse): Promise<T> {
  const body = await res.json();
  expect(
    body.success,
    `API call failed: ${res.url()} → ${JSON.stringify(body.error)}`,
  ).toBe(true);
  return body.data as T;
}

/** Parse a named cookie value from a response's `Set-Cookie` headers. */
function cookieFromResponse(res: APIResponse, name: string): string {
  const header = res
    .headersArray()
    .find(
      (h) => h.name.toLowerCase() === 'set-cookie' && h.value.startsWith(`${name}=`),
    );
  const value = header?.value.split(';', 1)[0]?.split('=').slice(1).join('=');
  if (!value) {
    throw new Error(`Cookie "${name}" not in Set-Cookie of ${res.url()}`);
  }
  return decodeURIComponent(value);
}

/** Build a Session from an auth response: user in the body, tokens in cookies. */
async function sessionFrom(res: APIResponse): Promise<Session> {
  // The body envelope's `data` is `{ user }` (tokens are cookie-only now).
  const { user } = await unwrap<{ user: Session['user'] }>(res);
  return {
    user,
    accessToken: cookieFromResponse(res, 'access_token'),
    refreshToken: cookieFromResponse(res, 'refresh_token'),
    csrfToken: cookieFromResponse(res, 'csrf_token'),
  };
}

/** Register a fresh user (unique email per run) and return its live session. */
export async function registerUser(
  request: APIRequestContext,
  role: 'CLIENT' | 'RESTAURANT_ADMIN',
  label: string,
): Promise<Session> {
  const email = `e2e.${label}.${Date.now()}${Math.floor(Math.random() * 1000)}@pensiones.test`;
  const res = await request.post(`${API_BASE}/auth/register`, {
    data: {
      email,
      password: DEMO_PASSWORD,
      fullName: `E2E ${label}`,
      role,
    },
  });
  return sessionFrom(res);
}

/** Create a PENDING restaurant owned by the given restaurant-admin session. */
export async function createPendingRestaurant(
  request: APIRequestContext,
  session: Session,
): Promise<{ id: string; name: string; slug: string }> {
  const name = `E2E Restaurante ${Date.now()}`;
  const res = await request.post(`${API_BASE}/restaurants/mine`, {
    headers: { Authorization: `Bearer ${session.accessToken}` },
    data: {
      name,
      description:
        'Restaurante creado por la suite E2E para validar la aprobación del super admin.',
      address: 'Av. Pruebas 123, Lima',
      contactPhone: '+51 999 888 777',
      contactEmail: `contacto.${Date.now()}@pensiones.test`,
      monthlyPensionPrice: 250,
    },
  });
  return unwrap<{ id: string; name: string; slug: string }>(res);
}

/**
 * Read a role's access token from the `access_token` cookie in the storageState
 * file written by `auth.setup.ts` (auth is cookie-based now, docs/security.md
 * A2), so authorization specs reuse the existing session instead of spending a
 * fresh login against the 5/min rate limit.
 */
export function accessTokenFromStorage(storageStatePath: string): string {
  const raw = JSON.parse(readFileSync(storageStatePath, 'utf8')) as {
    cookies?: { name: string; value: string }[];
  };
  const cookie = (raw.cookies ?? []).find((c) => c.name === 'access_token');
  if (!cookie) {
    throw new Error(`No access_token cookie found in ${storageStatePath}`);
  }
  return cookie.value;
}

/** Log a seeded user in through the API and return its live session. */
export async function loginUser(
  request: APIRequestContext,
  email: string,
  password: string = DEMO_PASSWORD,
): Promise<Session> {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  });
  return sessionFrom(res);
}

/** Pick a clean, seeded APPROVED restaurant slug (skips timestamped e2e rows). */
export async function firstDemoRestaurantSlug(
  request: APIRequestContext,
): Promise<{ slug: string; name: string }> {
  const res = await request.get(`${API_BASE}/restaurants?page=1&limit=100`);
  const data = await unwrap<{ items: { name: string; slug: string }[] }>(res);
  // Seed slugs are plain words; e2e artifacts carry a numeric timestamp.
  const clean = data.items.find((r) => !/\d/.test(r.slug));
  expect(clean, 'no seeded restaurant found in public catalog').toBeTruthy();
  return { slug: clean!.slug, name: clean!.name };
}
