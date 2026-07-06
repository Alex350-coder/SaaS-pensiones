/**
 * Clock port (docs/arquitectura.md §4): date logic must be testable and
 * UTC-consistent, so use cases never call `new Date()` directly.
 */
export const CLOCK = Symbol('CLOCK');

export interface Clock {
  now(): Date;
  /** Current calendar day at UTC midnight. */
  todayUtc(): Date;
}
