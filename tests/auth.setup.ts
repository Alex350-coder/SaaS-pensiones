/**
 * Authentication setup project: log in each seeded role once through the UI and
 * persist its session. Downstream specs reuse these storageStates, so a full run
 * spends only three login requests total — staying well under the API's 5/min
 * login rate limit.
 */
import { test as setup } from '@playwright/test';
import { SEED_USERS, STORAGE_STATE } from './support/data';
import { loginViaUi } from './support/pages';

setup('authenticate client', async ({ page }) => {
  await loginViaUi(page, SEED_USERS.client.email, SEED_USERS.client.home);
  await page.context().storageState({ path: STORAGE_STATE.client });
});

setup('authenticate restaurant admin', async ({ page }) => {
  await loginViaUi(page, SEED_USERS.restaurant.email, SEED_USERS.restaurant.home);
  await page.context().storageState({ path: STORAGE_STATE.restaurant });
});

setup('authenticate super admin', async ({ page }) => {
  await loginViaUi(page, SEED_USERS.admin.email, SEED_USERS.admin.home);
  await page.context().storageState({ path: STORAGE_STATE.admin });
});
