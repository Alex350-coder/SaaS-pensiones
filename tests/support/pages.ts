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
 * Seed a fresh session so a provisioned actor is "logged in" without spending a
 * login request. Auth now lives in httpOnly cookies (docs/security.md A2): the
 * tokens go into the browser cookie jar, and only the `user` is persisted in
 * the SPA store (mirrors the zustand `persist` shape of `pensiones.session`).
 */
export async function injectSession(page: Page, session: Session): Promise<void> {
  // Must be on the app origin before touching cookies/localStorage.
  await page.goto('/');
  const origin = new URL(page.url()).origin;

  await page.context().addCookies([
    { name: 'access_token', value: session.accessToken, url: origin, httpOnly: true, sameSite: 'Lax' },
    { name: 'refresh_token', value: session.refreshToken, url: origin, httpOnly: true, sameSite: 'Strict' },
    // Readable by the SPA so api-client can echo it in X-CSRF-Token.
    { name: 'csrf_token', value: session.csrfToken, url: origin, httpOnly: false, sameSite: 'Lax' },
  ]);

  await page.evaluate((s) => {
    localStorage.setItem(
      'pensiones.session',
      JSON.stringify({ state: { user: s.user }, version: 0 }),
    );
  }, session);
}

/** Assert a private page heading (PageHeading renders an <h1>) is visible. */
export async function expectHeading(page: Page, name: string): Promise<void> {
  await expect(
    page.getByRole('heading', { level: 1, name, exact: true }),
  ).toBeVisible({ timeout: 15_000 });
}
