import { test, expect } from '@playwright/test';
import { STORAGE_STATE } from './support/data';

/**
 * Realtime chat (Socket.IO through the Vite proxy) as the seeded pensioner:
 * open the conversation with the restaurant and send a message, asserting it
 * echoes back into the thread — proving the WS handshake + send + broadcast.
 */
test.use({ storageState: STORAGE_STATE.client });

test('client sends a chat message and sees it in the thread', async ({
  page,
}) => {
  await page.goto('/app/mensajes');
  await expect(
    page.getByRole('heading', { level: 1, name: 'Mensajes' }),
  ).toBeVisible();

  // Open the first (seeded) conversation with the restaurant admin.
  const firstConversation = page.locator('ul > li > button').first();
  await expect(firstConversation).toBeVisible();
  await firstConversation.click();

  const composer = page.getByPlaceholder('Escribe un mensaje…');
  await expect(composer).toBeVisible();

  const message = `E2E ping ${Date.now()}`;
  await composer.fill(message);
  await page.getByRole('button', { name: 'Enviar mensaje' }).click();

  // The message echoes back into the thread over the socket.
  await expect(page.getByText(message)).toBeVisible({ timeout: 15_000 });
  // Composer clears after a successful send.
  await expect(composer).toHaveValue('');
});
