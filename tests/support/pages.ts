/**
 * Page-interaction helpers shared across specs.
 */
import { Page, expect } from '@playwright/test';
import { DEMO_PASSWORD } from './data';
import type { Session } from './api';

/** Log in through the UI and wait until the role's home area is reached. */
export async function loginViaUi(
  page: Page,
  email: string,
  expectedHome: string,
  password = DEMO_PASSWORD,
): Promise<void> {
  await page.goto('/ingresar');
  // Target inputs by their stable ids (the visible labels carry a required
  // marker, and "Contraseña" also matches the show/hide toggle's aria-label).
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.waitForURL((url) => url.pathname.startsWith(expectedHome), {
    timeout: 15_000,
  });
}

/**
 * Seed a fresh session straight into the SPA's persisted store so a provisioned
 * actor is "logged in" without spending a login request. Mirrors the zustand
 * `persist` shape of `pensiones.session` (see `stores/session-store.ts`).
 */
export async function injectSession(page: Page, session: Session): Promise<void> {
  // Must be on the app origin before touching its localStorage.
  await page.goto('/');
  await page.evaluate((s) => {
    localStorage.setItem(
      'pensiones.session',
      JSON.stringify({
        state: {
          user: s.user,
          tokens: { accessToken: s.accessToken, refreshToken: s.refreshToken },
        },
        version: 0,
      }),
    );
  }, session);
}

/** Assert a private page heading (PageHeading renders an <h1>) is visible. */
export async function expectHeading(page: Page, name: string): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name, exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}
