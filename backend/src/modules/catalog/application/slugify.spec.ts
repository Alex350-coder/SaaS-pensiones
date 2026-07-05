import { slugify } from './slugify';

describe('slugify', () => {
  it('lowercases and kebab-cases', () => {
    expect(slugify('El Fogón Andino')).toBe('el-fogon-andino');
  });

  it('strips accents and ñ-like diacritics', () => {
    expect(slugify('Doña Carmen Sazón')).toBe('dona-carmen-sazon');
  });

  it('collapses symbol runs into single dashes and trims edges', () => {
    expect(slugify('  ¡¡Mar & Sazón!!  ')).toBe('mar-sazon');
  });

  it('caps the slug at 120 characters', () => {
    expect(slugify('a'.repeat(300)).length).toBeLessThanOrEqual(120);
  });

  it('returns empty string for symbol-only names (caller applies fallback)', () => {
    expect(slugify('!!!')).toBe('');
  });
});
