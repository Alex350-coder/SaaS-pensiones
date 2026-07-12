import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './support/data';
import { expectHeading } from './support/pages';

/**
 * Restaurant-admin surfaces as the owner of El Fogón Andino: the dashboard
 * metrics (derived from real rows) and the operational pages render.
 */
test.use({ storageState: STORAGE_STATE.restaurant });

test('owner dashboard shows the metric tiles', async ({ page }) => {
  await page.goto('/panel');
  await expectHeading(page, 'Resumen');

  // Metric labels from RestaurantHomePage (each derives from raw data).
  await expect(page.getByText('Pensionarios activos')).toBeVisible();
  await expect(page.getByText('Reservas de hoy')).toBeVisible();
  await expect(page.getByText('Ingresos estimados')).toBeVisible();

  // Onboarding empty-state should NOT show — this owner has a restaurant.
  await expect(page.getByText('Crea tu restaurante')).toHaveCount(0);
});

test('owner can open pensioners and reservations/projection', async ({
  page,
}) => {
  await page.goto('/panel/pensionarios');
  await expectHeading(page, 'Pensionarios');

  await page.goto('/panel/reservas');
  await expectHeading(page, 'Reservas y asistencia');
});
