import { z } from 'zod';

/** True only for a syntactically valid absolute http(s) URL. Never throws. */
function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === 'http:' || protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Optional image URL: an empty string, or an absolute http(s) URL. The scheme
 * check rejects `javascript:` / `data:` and other non-web schemes so a value
 * can never smuggle in an executable URL — defense-in-depth in case a field
 * currently rendered as `<img src>` is ever rendered as a link. Shared by the
 * restaurant profile (logo/cover) and dish image forms (DRY).
 */
export const optionalImageUrl = z.union([
  z.string().trim().refine(isHttpUrl, 'Ingresa una URL http(s) válida.'),
  z.literal(''),
]);
