/**
 * Only allow same-site, path-only redirects after auth. Rejects absolute URLs
 * and protocol-relative (`//evil.com`) values to prevent open-redirects.
 */
export function safeRedirect(value: string | null, fallback = '/'): string {
  if (!value) return fallback;
  if (!value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}
