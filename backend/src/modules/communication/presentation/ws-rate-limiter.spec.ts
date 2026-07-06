import { WsRateLimiter } from './ws-rate-limiter';

describe('WsRateLimiter', () => {
  it('allows up to the limit within one window and then rejects', () => {
    const limiter = new WsRateLimiter(3, 10_000);
    const t0 = 1_000;

    expect(limiter.allow('user-1', t0)).toBe(true);
    expect(limiter.allow('user-1', t0 + 1)).toBe(true);
    expect(limiter.allow('user-1', t0 + 2)).toBe(true);
    expect(limiter.allow('user-1', t0 + 3)).toBe(false);
  });

  it('resets the budget when the window rolls over', () => {
    const limiter = new WsRateLimiter(1, 10_000);
    const t0 = 1_000;

    expect(limiter.allow('user-1', t0)).toBe(true);
    expect(limiter.allow('user-1', t0 + 1)).toBe(false);
    expect(limiter.allow('user-1', t0 + 10_000)).toBe(true);
  });

  it('tracks users independently', () => {
    const limiter = new WsRateLimiter(1, 10_000);

    expect(limiter.allow('user-1', 0)).toBe(true);
    expect(limiter.allow('user-2', 1)).toBe(true);
    expect(limiter.allow('user-1', 2)).toBe(false);
    expect(limiter.allow('user-2', 3)).toBe(false);
  });

  it('prunes expired buckets instead of growing forever', () => {
    const limiter = new WsRateLimiter(1, 10);
    for (let i = 0; i < 100; i += 1) {
      limiter.allow(`user-${i}`, i * 20); // each call expires the previous
    }
    // Internal map only retains live windows (whitebox but keeps the
    // unbounded-growth guarantee under test).
    expect(
      (limiter as unknown as { buckets: Map<string, unknown> }).buckets.size,
    ).toBeLessThanOrEqual(2);
  });
});
