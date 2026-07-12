import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  dayName,
  formatClockTime,
  formatCurrency,
  formatDate,
  formatDateTime,
  formatMenuDate,
  formatRelativeTime,
  formatTime,
  monogram,
} from './format';

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

describe('formatRelativeTime', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-11T12:00:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('reads sub-minute deltas as "ahora"', () => {
    expect(formatRelativeTime('2026-07-11T11:59:40Z')).toBe('ahora');
  });

  it('formats minutes and hours in the past', () => {
    expect(formatRelativeTime('2026-07-11T11:30:00Z')).toMatch(/min|minuto/);
    expect(formatRelativeTime('2026-07-11T09:00:00Z')).toMatch(/hora|h/);
  });

  it('formats days and months', () => {
    expect(formatRelativeTime('2026-07-09T12:00:00Z')).toMatch(/d|día|anteayer/);
    expect(formatRelativeTime('2026-05-11T12:00:00Z')).toMatch(/mes/);
  });

  it('returns empty string for an unparsable timestamp', () => {
    expect(formatRelativeTime('not-a-date')).toBe('');
  });
});

describe('formatDateTime / formatClockTime', () => {
  it('renders a short absolute date-time', () => {
    expect(formatDateTime('2026-07-07T11:30:00Z')).toMatch(/jul/);
  });

  it('renders a clock time for chat bubbles', () => {
    expect(formatClockTime('2026-07-07T11:30:00Z')).toMatch(/\d/);
  });

  it('returns empty string on invalid input', () => {
    expect(formatDateTime('nope')).toBe('');
    expect(formatClockTime('nope')).toBe('');
  });
});

describe('formatDate', () => {
  it('formats a date-only value at UTC noon (no day shift)', () => {
    expect(formatDate('2026-07-07')).toMatch(/2026/);
    expect(formatDate('2026-07-07')).toMatch(/jul/);
  });

  it('formats a full ISO timestamp', () => {
    expect(formatDate('2026-07-07T00:00:00Z')).toMatch(/2026/);
  });

  it('returns empty string on invalid input', () => {
    expect(formatDate('nope')).toBe('');
  });
});
