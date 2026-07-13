import { z } from 'zod';

/**
 * Environment contract. The app refuses to boot on an invalid environment
 * (fail fast at the system boundary).
 *
 * DATABASE_URL (migration owner) is used only by the Prisma CLI and is NOT
 * part of the runtime contract: the API connects with APP_DATABASE_URL, a
 * least-privilege role (no DDL, append-only audit_logs).
 */
export const envSchema = z.object({
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  APP_DATABASE_URL: z
    .url()
    .startsWith('postgresql://', 'APP_DATABASE_URL must be a postgresql:// URL'),
  JWT_ACCESS_SECRET: z
    .string()
    .min(32, 'JWT_ACCESS_SECRET must be at least 32 characters'),
  // Short-lived by design (docs/security.md §4): 15 minutes.
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().positive().default(900),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(7),
  // Comma-separated allow-list of browser origins for CORS. Empty in dev
  // (same-origin via the Vite proxy); set to the real frontend origin(s) in
  // production. `credentials: true` is always on because auth uses cookies.
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((raw) =>
      raw
        .split(',')
        .map((origin) => origin.trim())
        .filter((origin) => origin.length > 0),
    ),
  // Marks auth cookies `Secure` (HTTPS-only). Defaults to on in production.
  // Overridable so a non-TLS staging box can still authenticate.
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => value === 'true'),
  // Optional cookie `Domain`. Leave unset for host-only cookies (recommended
  // for the same-origin reverse-proxy topology).
  COOKIE_DOMAIN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const result = envSchema.safeParse(config);
  if (!result.success) {
    const issues = result.error.issues
      .map((issue) => `- ${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return result.data;
}
