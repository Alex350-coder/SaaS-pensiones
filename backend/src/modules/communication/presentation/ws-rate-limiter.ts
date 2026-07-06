/**
 * Per-user fixed-window rate limiter for the WS gateway. Needed because the
 * global ThrottlerGuard never runs for @SubscribeMessage handlers in this
 * @nestjs/websockets version (GuardsContextCreator is built without
 * ApplicationConfig, so global guards resolve to []) — verified in review.
 * In-memory on purpose: single-instance deployment (docs/arquitectura.md
 * ADR #1); a multi-instance future moves this to Redis with the WS adapter.
 */
export const WS_WINDOW_MS = 10_000;
export const WS_EVENTS_PER_WINDOW = 30;

interface Bucket {
  count: number;
  resetAt: number;
}

export class WsRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly limit: number = WS_EVENTS_PER_WINDOW,
    private readonly windowMs: number = WS_WINDOW_MS,
  ) {}

  /** Counts one event for `key`; false means the window budget is spent. */
  allow(key: string, now: number = Date.now()): boolean {
    const bucket = this.buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      this.prune(now);
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return true;
    }
    bucket.count += 1;
    return bucket.count <= this.limit;
  }

  /** Expired buckets are dropped lazily so the map cannot grow unbounded. */
  private prune(now: number): void {
    for (const [key, bucket] of this.buckets) {
      if (now >= bucket.resetAt) {
        this.buckets.delete(key);
      }
    }
  }
}
