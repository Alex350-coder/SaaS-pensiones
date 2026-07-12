import { test, expect } from '@playwright/test';

/**
 * Public journey (no auth): landing → catalog → restaurant detail.
 * Proves the anonymous funnel and real catalog data render end to end.
 */
test.describe('Public catalog journey', () => {
  test('lands, browses the catalog, and opens a restaurant detail', async ({
    page,
  }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1 }),
    ).toBeVisible();

    // Hero CTA into the catalog.
    await page.getByRole('link', { name: 'Explorar restaurantes' }).click();
    await page.waitForURL('**/restaurantes');
    await expect(
      page.getByRole('heading', { level: 1, name: 'Restaurantes' }),
    ).toBeVisible();

    // Open the first restaurant card (aria-label "Ver {name}").
    const firstCard = page.getByRole('link', { name: /^Ver / }).first();
    await expect(firstCard).toBeVisible();
    await firstCard.click();

    await page.waitForURL(/\/restaurantes\/[^/]+$/);
    // Detail shows the restaurant name (h1) and the contract CTA for visitors.
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(
      page.getByRole('button', { name: 'Contratar pensión' }),
    ).toBeVisible();
  });

  test('unknown route renders the 404 page', async ({ page }) => {
    await page.goto('/ruta-que-no-existe');
    await expect(page.getByText(/404|no encontrada|no existe/i).first()).toBeVisible();
  });
});
