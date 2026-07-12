/** Formatting helpers — locale-aware, Peru (es-PE / PEN). */

const currencyFormatter = new Intl.NumberFormat('es-PE', {
  style: 'currency',
  currency: 'PEN',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Money as `S/ 742.00`. Prices arrive as plain numbers from the API. */
export function formatCurrency(value: number): string {
  return currencyFormatter.format(value);
}

const DAY_NAMES = [
  'Domingo',
  'Lunes',
  'Martes',
  'Miércoles',
  'Jueves',
  'Viernes',
  'Sábado',
] as const;

/** Backend `dayOfWeek` is 0=Sunday..6=Saturday (Postgres DOW convention). */
export function dayName(dayOfWeek: number): string {
  return DAY_NAMES[dayOfWeek] ?? '';
}

/** `HH:MM` (24h) → `11:30 a. m.` style short time. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  const date = new Date(1970, 0, 1, h, m);
  return new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** `YYYY-MM-DD` → `lunes, 7 de julio`. Parsed as a local calendar date. */
export function formatMenuDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  const date = new Date(y, (m ?? 1) - 1, d ?? 1);
  return new Intl.DateTimeFormat('es-PE', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(date);
}

const relativeFormatter = new Intl.RelativeTimeFormat('es-PE', {
  numeric: 'auto',
});

const RELATIVE_STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
];

/** ISO timestamp → `hace 5 min`, `ayer`, etc. Sub-minute reads as "ahora". */
export function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffSeconds = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(diffSeconds);
  if (abs < 45) return 'ahora';
  for (const [unit, seconds] of RELATIVE_STEPS) {
    if (abs >= seconds) {
      return relativeFormatter.format(Math.round(diffSeconds / seconds), unit);
    }
  }
  return 'ahora';
}

/** ISO timestamp → `7 jul, 11:30 a. m.` short absolute date-time. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** Date-only (`YYYY-MM-DD` or ISO) → `7 jul 2026`. Parsed as UTC noon to
 *  avoid the day shifting under the local timezone. */
export function formatDate(value: string): string {
  const iso = value.length === 10 ? `${value}T12:00:00Z` : value;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

/** ISO timestamp → `11:30 a. m.` clock time, for chat bubbles. */
export function formatClockTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('es-PE', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

/** First-letter monogram for the image-less restaurant fallback. */
export function monogram(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return '?';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}
