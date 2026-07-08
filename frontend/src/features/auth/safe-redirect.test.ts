import { describe, expect, it } from 'vitest';
import { safeRedirect } from './safe-redirect';

describe('safeRedirect', () => {
  it('allows same-site path-only redirects', () => {
    expect(safeRedirect('/restaurantes/el-fogon-andino')).toBe(
      '/restaurantes/el-fogon-andino',
    );
  });

  it('rejects protocol-relative URLs (open-redirect)', () => {
    expect(safeRedirect('//evil.com')).toBe('/');
  });

  it('rejects absolute URLs', () => {
    expect(safeRedirect('https://evil.com')).toBe('/');
  });

  it('returns the fallback for null', () => {
    expect(safeRedirect(null, '/inicio')).toBe('/inicio');
  });
});
