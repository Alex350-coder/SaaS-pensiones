import { defineConfig, devices } from '@playwright/test';
import { APP_BASE } from './tests/support/data';

/**
 * Phase 14 E2E — page-level critical flows against the real running stack
 * (Vite SPA → Nest API → Postgres). Vitest covers application logic + reusable
 * components to ≥80%; Playwright covers the end-to-end journeys unit tests
 * cannot: contract a pension, reserve today's menu, confirm attendance, chat,
 * and super-admin restaurant approval.
 *
 * Prereqs: the backend + Postgres are up (docker compose up). `globalSetup`
 * reseeds the demo DB so date-relative data is fresh; the `setup` project logs
 * each role in once and shares the session via storageState.
 */
export default defineConfig({
  testDir: './tests',
  globalSetup: './tests/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 1,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 45_000,
  expect: { timeout: 10_000 },
  use: {
    baseURL: APP_BASE,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /auth\.setup\.ts/ },
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
  ],
  /* Boot the SPA dev server; it proxies /api and /socket.io to the API. */
  webServer: {
    command: 'pnpm -C frontend dev',
    url: APP_BASE,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
