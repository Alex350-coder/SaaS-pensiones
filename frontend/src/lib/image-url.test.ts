import { describe, expect, test } from 'vitest';
import { optionalImageUrl } from './image-url';

describe('optionalImageUrl', () => {
  test('accepts an empty string (field is optional)', () => {
    expect(optionalImageUrl.safeParse('').success).toBe(true);
  });

  test('accepts http and https URLs', () => {
    expect(optionalImageUrl.safeParse('https://cdn.example.com/a.jpg').success).toBe(true);
    expect(optionalImageUrl.safeParse('http://example.com/logo.png').success).toBe(true);
  });

  test('trims surrounding whitespace before validating', () => {
    expect(optionalImageUrl.safeParse('  https://example.com/a.jpg  ').success).toBe(true);
  });

  test('rejects javascript: and data: schemes', () => {
    expect(optionalImageUrl.safeParse('javascript:alert(1)').success).toBe(false);
    expect(optionalImageUrl.safeParse('data:text/html,<script>1</script>').success).toBe(false);
  });

  test('rejects a non-URL string', () => {
    expect(optionalImageUrl.safeParse('not a url').success).toBe(false);
  });
});
