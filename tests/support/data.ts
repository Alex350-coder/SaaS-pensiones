/**
 * Shared test data and constants for the Playwright E2E suite.
 *
 * Credentials come from the demo seed (`backend/prisma/seed.ts`), which the
 * global setup re-runs before the suite so the data is always fresh and the
 * date-relative menus/pensions line up with "today".
 */

/** Password shared by every seeded user (see `DEMO_PASSWORD` in the seed). */
export const DEMO_PASSWORD = 'Password123!';

/** Backend API base (hit directly for setup; the SPA uses the Vite proxy). */
export const API_BASE = process.env.E2E_API_BASE ?? 'http://localhost:3000/api/v1';

/** SPA base URL (Vite dev server, proxies `/api` and `/socket.io` to the API). */
export const APP_BASE = process.env.E2E_APP_BASE ?? 'http://localhost:5173';

/** Seeded accounts used by the critical-flow specs. */
export const SEED_USERS = {
  /** Client with an ACTIVE pension at "El Fogón Andino" + today's menu/chat. */
  client: { email: 'maria@pensiones.dev', role: 'CLIENT' as const, home: '/app' },
  /** Owner of "El Fogón Andino" (maria's restaurant). */
  restaurant: {
    email: 'admin.fogon@pensiones.dev',
    role: 'RESTAURANT_ADMIN' as const,
    home: '/panel',
  },
  /** Platform super admin (restaurant approval + user management + audit). */
  admin: {
    email: 'superadmin@pensiones.dev',
    role: 'SUPER_ADMIN' as const,
    home: '/admin',
  },
} satisfies Record<
  string,
  { email: string; role: string; home: string }
>;

/** Where each role's login should land (mirrors `frontend/src/lib/roles.ts`). */
export const ROLE_HOME: Record<string, string> = {
  CLIENT: '/app',
  RESTAURANT_ADMIN: '/panel',
  SUPER_ADMIN: '/admin',
};

/** storageState files written by `auth.setup.ts`, one per seeded role. */
export const STORAGE_STATE = {
  client: 'tests/.auth/client.json',
  restaurant: 'tests/.auth/restaurant.json',
  admin: 'tests/.auth/admin.json',
} as const;
