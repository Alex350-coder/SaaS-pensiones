import { test, expect } from '@playwright/test';
import { SEED_USERS, STORAGE_STATE } from './support/data';

/**
 * Authentication + route-guard behavior. Kept economical on login requests
 * (the API rate-limits login 5/min): one invalid attempt here, the valid
 * logins live in `auth.setup.ts`.
 */
test.describe('Auth and route guards', () => {
  test('rejects invalid credentials with a Spanish error', async ({ page }) => {
    await page.goto('/ingresar');
    await page.locator('#email').fill(SEED_USERS.client.email);
    await page.locator('#password').fill('WrongPassword123!');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    const alert = page.getByRole('alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText(/incorrect/i);
    // Still on the login page — no session established.
    await expect(page).toHaveURL(/\/ingresar/);
  });

  test('redirects an anonymous visitor away from a private area', async ({
    page,
  }) => {
    await page.goto('/app');
    await page.waitForURL(/\/ingresar/);
    await expect(
      page.getByRole('button', { name: 'Ingresar' }),
    ).toBeVisible();
  });

  test.describe('role isolation', () => {
    test.use({ storageState: STORAGE_STATE.client });

    test('keeps a client out of the super-admin area', async ({ page }) => {
      await page.goto('/admin');
      // RequireRole sends the wrong role to its own home, never a dead end.
      await page.waitForURL(/\/app(\/|$)/);
      await expect(page).not.toHaveURL(/\/admin/);
    });
  });
});
