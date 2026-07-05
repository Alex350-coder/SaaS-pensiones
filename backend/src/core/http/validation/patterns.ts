/** Shared validation patterns (DRY across bounded contexts). */

/** Loose international phone: digits, spaces, parens, dashes, optional +. */
export const PHONE_PATTERN = /^\+?[\d\s()-]{6,30}$/;

export const PHONE_PATTERN_MESSAGE = 'El teléfono no tiene un formato válido.';

/** 24h wall-clock time, HH:MM. */
export const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export const TIME_PATTERN_MESSAGE = 'La hora debe tener formato HH:MM (24h).';
