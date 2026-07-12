/**
 * Phase 15 security review — adversarial authorization tests.
 *
 * These assert the access-control invariants from docs/security.md directly at
 * the API boundary (no UI), so they are deterministic regression guards:
 *   - A4 / OWASP A01 vertical escalation: a role cannot reach another role's
 *     endpoints (deny-by-default RBAC).
 *   - A3 horizontal escalation / IDOR: a client cannot read another client's
 *     invoice by guessing its id — ownership is enforced at the DB and the
 *     wrong requester gets the same 404, so existence never leaks.
 *   - A07 auth failures: missing, malformed, and tampered tokens are rejected.
 *   - A13 DoS: paginated listings cap `limit` server-side.
 *
 * Tokens for maria (CLIENT) and admin.fogon (RESTAURANT_ADMIN) are read from
 * the storageState written by auth.setup.ts, so the only fresh login this spec
 * spends is the attacker (a second seeded client on a different tenant).
 */
import { expect, test, type APIRequestContext } from '@playwright/test';
import { accessTokenFromStorage, loginUser } from './support/api';
import { API_BASE, STORAGE_STATE } from './support/data';

/**
 * Serial: one worker, so the attacker logs in exactly once. Parallel workers
 * would each re-run beforeAll and multiply the login calls past the 5/min auth
 * rate limit (which is itself a control under test).
 */
test.describe.configure({ mode: 'serial' });

/** A second seeded CLIENT (see backend/prisma/seed.ts) with no invoices. */
const ATTACKER_CLIENT_EMAIL = 'jose@pensiones.dev';

let victimClientToken: string; // maria — owns exactly one seeded invoice
let restaurantAdminToken: string; // admin.fogon — owns maria's restaurant
let attackerClientToken: string; // jose — different tenant, must see nothing of maria's
let victimInvoiceId: string;

const auth = (token: string): Record<string, string> => ({
  Authorization: `Bearer ${token}`,
});

async function codeOf(res: import('@playwright/test').APIResponse): Promise<string> {
  const body = (await res.json()) as { error?: { code?: string } };
  return body.error?.code ?? '';
}

test.describe('Security — authorization boundaries', () => {
  test.beforeAll(async ({ request }) => {
    victimClientToken = accessTokenFromStorage(STORAGE_STATE.client);
    restaurantAdminToken = accessTokenFromStorage(STORAGE_STATE.restaurant);

    const attacker = await loginUser(request, ATTACKER_CLIENT_EMAIL);
    attackerClientToken = attacker.accessToken;

    const res = await request.get(`${API_BASE}/invoices?page=1&limit=1`, {
      headers: auth(victimClientToken),
    });
    const body = (await res.json()) as {
      data: { items: { id: string }[] };
    };
    expect(
      body.data.items.length,
      'seed should give maria one invoice for her active pension',
    ).toBeGreaterThan(0);
    victimInvoiceId = body.data.items[0].id;
  });

  test.describe('A07 — token authentication', () => {
    test('rejects a request with no Bearer token', async ({ request }) => {
      const res = await request.get(`${API_BASE}/auth/me`);
      expect(res.status()).toBe(401);
      expect(await codeOf(res)).toBe('MISSING_ACCESS_TOKEN');
    });

    test('rejects a malformed token', async ({ request }) => {
      const res = await request.get(`${API_BASE}/auth/me`, {
        headers: auth('not-a-jwt'),
      });
      expect(res.status()).toBe(401);
      expect(await codeOf(res)).toBe('INVALID_ACCESS_TOKEN');
    });

    test('rejects a token with a tampered signature', async ({ request }) => {
      // Flip the last signature char: valid shape, invalid HS256 signature.
      const tampered = victimClientToken.slice(0, -1) +
        (victimClientToken.endsWith('a') ? 'b' : 'a');
      const res = await request.get(`${API_BASE}/auth/me`, {
        headers: auth(tampered),
      });
      expect(res.status()).toBe(401);
      expect(await codeOf(res)).toBe('INVALID_ACCESS_TOKEN');
    });
  });

  test.describe('A4 / A01 — vertical escalation is denied', () => {
    const clientForbidden = [
      { name: 'super-admin user list', path: '/admin/users' },
      { name: 'super-admin restaurant list', path: '/admin/restaurants' },
      { name: 'restaurant dashboard', path: '/restaurants/mine/dashboard' },
    ];

    for (const target of clientForbidden) {
      test(`CLIENT cannot reach ${target.name}`, async ({ request }) => {
        const res = await request.get(`${API_BASE}${target.path}`, {
          headers: auth(victimClientToken),
        });
        expect(res.status()).toBe(403);
        expect(await codeOf(res)).toBe('FORBIDDEN');
      });
    }

    test('RESTAURANT_ADMIN cannot reach super-admin user list', async ({
      request,
    }) => {
      const res = await request.get(`${API_BASE}/admin/users`, {
        headers: auth(restaurantAdminToken),
      });
      expect(res.status()).toBe(403);
      expect(await codeOf(res)).toBe('FORBIDDEN');
    });
  });

  test.describe('A3 — horizontal escalation / IDOR is denied', () => {
    test('a client cannot download another client\'s invoice PDF', async ({
      request,
    }) => {
      const res = await request.get(
        `${API_BASE}/invoices/${victimInvoiceId}/pdf`,
        { headers: auth(attackerClientToken) },
      );
      // 404 (not 403, not the PDF): ownership is filtered in the query, so a
      // wrong requester cannot even tell the invoice exists.
      expect(res.status()).toBe(404);
      expect(await codeOf(res)).toBe('INVOICE_NOT_FOUND');
    });

    test('another client\'s invoice never appears in the attacker\'s list', async ({
      request,
    }) => {
      const res = await request.get(`${API_BASE}/invoices?page=1&limit=100`, {
        headers: auth(attackerClientToken),
      });
      expect(res.status()).toBe(200);
      const body = (await res.json()) as {
        data: { items: { id: string }[] };
      };
      const ids = body.data.items.map((invoice) => invoice.id);
      expect(ids).not.toContain(victimInvoiceId);
    });

    test('the legitimate owner CAN download her own invoice PDF', async ({
      request,
    }) => {
      const res = await request.get(
        `${API_BASE}/invoices/${victimInvoiceId}/pdf`,
        { headers: auth(victimClientToken) },
      );
      expect(res.status()).toBe(200);
      expect(res.headers()['content-type']).toContain('application/pdf');
    });
  });

  test.describe('A13 — paginated listings cap the page size', () => {
    test('rejects a limit above the server maximum', async ({ request }) => {
      const res = await request.get(`${API_BASE}/restaurants?page=1&limit=101`);
      expect(res.status()).toBe(400);
      expect(await codeOf(res)).toBe('VALIDATION_ERROR');
    });
  });
});
