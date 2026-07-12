import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './support/data';
import { expectHeading } from './support/pages';
import { registerUser, createPendingRestaurant } from './support/api';

/**
 * Critical flow: super-admin restaurant approval. A brand-new restaurant admin
 * + PENDING restaurant is provisioned via the API each run (so the approval is
 * always available and the spec is re-runnable), then approved through the UI.
 */
test.use({ storageState: STORAGE_STATE.admin });

test('super admin approves a pending restaurant', async ({ page, request }) => {
  // Arrange: fresh owner + PENDING restaurant straight through the API.
  const owner = await registerUser(request, 'RESTAURANT_ADMIN', 'owner');
  const restaurant = await createPendingRestaurant(request, owner);

  // Act: open the admin panel, narrow to pending, approve the new one.
  await page.goto('/admin');
  await expectHeading(page, 'Restaurantes');
  await page.getByRole('button', { name: 'Pendientes' }).click();

  const row = page.getByRole('row', { name: new RegExp(restaurant.name) });
  await expect(row).toBeVisible();
  await expect(row.getByText('Pendiente')).toBeVisible();

  const [res] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().includes(`/admin/restaurants/${restaurant.id}/status`) &&
        r.request().method() === 'PATCH',
    ),
    row.getByRole('button', { name: 'Aprobar' }).click(),
  ]);
  expect(res.ok()).toBeTruthy();

  // Assert: it left the "pending" filter (approved).
  await expect(page.getByText('Restaurante aprobado.')).toBeVisible();
  await expect(
    page.getByRole('row', { name: new RegExp(restaurant.name) }),
  ).toHaveCount(0);
});
