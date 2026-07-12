import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './support/data';
import { expectHeading } from './support/pages';

/**
 * Client critical flows against the real API, as the seeded pensioner "maria"
 * (ACTIVE pension at El Fogón Andino, today's menu published by the reseed):
 * view the pension, reserve a day's menu, confirm attendance, see invoices.
 */
test.use({ storageState: STORAGE_STATE.client });

/** ISO date (UTC) N days from today — matches the app's date handling. */
function isoInDays(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

test('client sees their active pension on the home surface', async ({ page }) => {
  await page.goto('/app');
  await expectHeading(page, 'Mi pensión');
  // An active pension shows its restaurant and day/payment progress, not the
  // "sin pensión" empty state.
  await expect(page.getByText('Aún no tienes una pensión')).toHaveCount(0);
});

test('client reserves a day menu end to end', async ({ page }) => {
  await page.goto('/app/reservas');
  await expectHeading(page, 'Reservas');

  // Pick a near-future day (published in the seed range, no existing booking).
  await page.getByLabel('Fecha').fill(isoInDays(2));

  // Real menu data loaded for that date.
  await expect(page.getByText('Precio del menú')).toBeVisible();

  const reserve = page.getByRole('button', { name: 'Reservar' });
  await expect(reserve).toBeVisible();

  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/reservations') && r.request().method() === 'POST',
    ),
    reserve.click(),
  ]);
  expect(res.ok()).toBeTruthy();

  // The reserve card flips to the "already reserved" state.
  await expect(page.getByText('Ya reservaste este menú')).toBeVisible();

  // Clean up so the surface returns to its pre-test state.
  await page
    .getByText('Ya reservaste este menú')
    .locator('xpath=ancestor::div[1]')
    .getByRole('button', { name: 'Cancelar' })
    .click();
});

test('client confirms attendance for a day', async ({ page }) => {
  await page.goto('/app/asistencia');
  await expectHeading(page, 'Asistencia');

  const willAttend = page.getByRole('button', { name: 'Asistiré' }).first();
  await expect(willAttend).toBeVisible();

  const [res] = await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/attendance') && r.request().method() === 'PUT',
    ),
    willAttend.click(),
  ]);
  expect(res.ok()).toBeTruthy();
});

test('client can open their invoices surface', async ({ page }) => {
  await page.goto('/app/facturas');
  await expectHeading(page, 'Facturas');
});
