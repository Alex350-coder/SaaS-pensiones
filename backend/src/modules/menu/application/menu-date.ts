/**
 * Menu-domain aliases over the shared UTC calendar-day helpers
 * (core/dates/utc-date.ts) — single implementation, domain-named surface.
 */
export {
  parseUtcDate as parseMenuDate,
  formatUtcDate as formatMenuDate,
  todayUtc as todayMenuDate,
  UTC_DATE_PATTERN as MENU_DATE_PATTERN,
} from '../../../core/dates/utc-date';
