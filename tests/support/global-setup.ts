/**
 * Global setup: refresh the demo database before the suite runs.
 *
 * The seed is date-relative (today always has a published menu, maria always
 * holds a live pension) and idempotent (upserts). Re-running it guarantees the
 * critical-flow specs — reserve today's menu, confirm today's attendance, chat —
 * line up with real, current data, so the suite is deterministic and re-runnable.
 *
 * Set `E2E_SKIP_SEED=1` to skip (e.g. when the DB was just seeded manually).
 */
import { execSync } from 'node:child_process';
import { join } from 'node:path';

// Playwright runs from the repo root (where playwright.config.ts lives).
const backendDir = join(process.cwd(), 'backend');

export default function globalSetup(): void {
  if (process.env.E2E_SKIP_SEED === '1') {
    console.log('[e2e] E2E_SKIP_SEED=1 — skipping database reseed.');
    return;
  }
  console.log('[e2e] Reseeding demo database (idempotent)…');
  execSync('pnpm db:seed', { cwd: backendDir, stdio: 'inherit' });
}
