import { describe, expect, it } from 'vitest';
import { dayName, formatCurrency, formatMenuDate, formatTime, monogram } from './format';

describe('formatCurrency', () => {
  it('formats a number as PEN with two decimals', () => {
    expect(formatCurrency(742)).toContain('742.00');
    expect(formatCurrency(742)).toMatch(/S\/./);
  });
});

describe('dayName', () => {
  it('maps Postgres DOW (0=Sunday) to Spanish names', () => {
    expect(dayName(0)).toBe('Domingo');
    expect(dayName(1)).toBe('Lunes');
    expect(dayName(6)).toBe('Sábado');
  });

  it('returns empty string for an out-of-range index', () => {
    expect(dayName(9)).toBe('');
  });
});

describe('formatTime', () => {
  it('renders a 24h HH:MM as a localized time', () => {
    expect(formatTime('11:30')).toMatch(/11:30/);
  });

  it('returns the input unchanged when malformed', () => {
    expect(formatTime('not-a-time')).toBe('not-a-time');
  });
});

describe('formatMenuDate', () => {
  it('formats an ISO date as weekday + day + month in Spanish', () => {
    const result = formatMenuDate('2026-07-07');
    expect(result).toMatch(/julio/);
    expect(result).toMatch(/7/);
  });
});

describe('monogram', () => {
  it('uses the initials of the first two words', () => {
    expect(monogram('El Fogón Andino')).toBe('EF');
  });

  it('uses the first two letters of a single word', () => {
    expect(monogram('Carmen')).toBe('CA');
  });

  it('falls back to a placeholder for an empty name', () => {
    expect(monogram('   ')).toBe('?');
  });
});
