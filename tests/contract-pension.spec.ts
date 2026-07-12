import { test, expect } from '@playwright/test';
import { registerUser, firstDemoRestaurantSlug } from './support/api';
import { injectSession } from './support/pages';

/**
 * Critical flow: contract a pension. A client may hold only one live pension,
 * so a FRESH client is provisioned via the API each run (no login request
 * spent — the register response seeds the session) and then contracts from the
 * public restaurant detail page through the UI.
 */
test('a new client contracts a pension from a restaurant page', async ({
  page,
  request,
}) => {
  const client = await registerUser(request, 'CLIENT', 'buyer');
  const { slug } = await firstDemoRestaurantSlug(request);

  await injectSession(page, client);
  await page.goto(`/restaurantes/${slug}`);

  await page.getByRole('button', { name: 'Contratar pensión' }).click();

  // Confirm in the dialog (its confirm button is labelled exactly "Contratar").
  const [res] = await Promise.all([
    page.waitForResponse(
      (r) =>
        r.url().endsWith('/pensions') && r.request().method() === 'POST',
    ),
    page.getByRole('button', { name: 'Contratar', exact: true }).click(),
  ]);
  expect(res.ok()).toBeTruthy();

  // Lands on the client area with the freshly contracted (pending) pension.
  await page.waitForURL(/\/app(\/|$)/);
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mi pensión' }),
  ).toBeVisible();
  await expect(page.getByText('Aún no tienes una pensión')).toHaveCount(0);
});
