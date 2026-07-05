import { formatMenuDate, parseMenuDate, todayMenuDate } from './menu-date';

describe('menu-date', () => {
  it('parses a valid date to UTC midnight', () => {
    const date = parseMenuDate('2026-07-05');

    expect(date.toISOString()).toBe('2026-07-05T00:00:00.000Z');
  });

  it('round-trips through formatMenuDate', () => {
    expect(formatMenuDate(parseMenuDate('2026-12-31'))).toBe('2026-12-31');
  });

  it.each(['2026-02-31', '2026-13-01', '05-07-2026', 'hoy', '2026-7-5'])(
    'rejects %s with INVALID_DATE',
    (value) => {
      expect(() => parseMenuDate(value)).toThrow(
        expect.objectContaining({
          response: expect.objectContaining({ code: 'INVALID_DATE' }),
        }) as Error,
      );
    },
  );

  it('todayMenuDate is anchored at UTC midnight', () => {
    const today = todayMenuDate();

    expect(today.toISOString().endsWith('T00:00:00.000Z')).toBe(true);
  });
});
