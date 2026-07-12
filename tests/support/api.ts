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
import { APIRequestContext, expect } from '@playwright/test';
import { API_BASE, DEMO_PASSWORD } from './data';

export interface Session {
  user: { id: string; email: string; fullName: string; role: string };
  accessToken: string;
  refreshToken: string;
}

/** Unwrap the `{ success, data, error }` envelope, asserting success. */
async function unwrap<T>(res: import('@playwright/test').APIResponse): Promise<T> {
  const body = await res.json();
  expect(
    body.success,
    `API call failed: ${res.url()} → ${JSON.stringify(body.error)}`,
  ).toBe(true);
  return body.data as T;
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
  return unwrap<Session>(res);
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
 * Read a role's access token straight from the storageState file written by
 * `auth.setup.ts`, so authorization specs reuse the existing session instead of
 * spending a fresh login against the 5/min rate limit.
 */
export function accessTokenFromStorage(storageStatePath: string): string {
  const raw = JSON.parse(readFileSync(storageStatePath, 'utf8')) as {
    origins: { localStorage: { name: string; value: string }[] }[];
  };
  for (const origin of raw.origins) {
    const entry = origin.localStorage.find(
      (item) => item.name === 'pensiones.session',
    );
    if (!entry) {
      continue;
    }
    const session = JSON.parse(entry.value) as {
      state: { tokens: { accessToken: string } };
    };
    return session.state.tokens.accessToken;
  }
  throw new Error(`No pensiones.session token found in ${storageStatePath}`);
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
  return unwrap<Session>(res);
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
