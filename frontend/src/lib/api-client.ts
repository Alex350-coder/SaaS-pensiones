import { useSessionStore } from '@/stores/session-store';

/** Standard API envelope returned by every backend endpoint. */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

type ApiEnvelope<T> =
  | { success: true; data: T; error: null }
  | { success: false; data: null; error: ApiErrorBody };

/** Paginated list envelope: `{ items, meta }`. */
export interface PageMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Paginated<T> {
  items: T[];
  meta: PageMeta;
}

/** Thrown on any non-success response; carries the stable code + Spanish copy. */
export class ApiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

const API_BASE = '/api/v1';
const NETWORK_ERROR = new ApiError(
  'NETWORK_ERROR',
  'No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.',
  0,
);

export interface RequestOptions {
  method?: string;
  body?: unknown;
  /**
   * Whether this call is part of an authenticated flow (default: true). Auth
   * travels in httpOnly cookies, so this no longer attaches a header — it only
   * gates the silent-refresh-on-401 retry. Public endpoints opt out.
   */
  auth?: boolean;
  signal?: AbortSignal;
  /** Internal: prevents infinite refresh recursion. */
  _isRetry?: boolean;
}

const CSRF_COOKIE = 'csrf_token';
const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Read the readable double-submit CSRF token the server set as a cookie. */
function readCsrfToken(): string | undefined {
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_COOKIE}=([^;]*)`),
  );
  return match ? decodeURIComponent(match[1]) : undefined;
}

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshPromise: Promise<boolean> | null = null;

/**
 * Ask the server to rotate the auth cookies using the httpOnly refresh cookie.
 * No token is read or returned by JS — success just means fresh cookies are
 * now set. Clears the local session on failure.
 */
async function refreshAccessToken(): Promise<boolean> {
  if (useSessionStore.getState().user === null) return false;

  refreshPromise ??= (async () => {
    try {
      const csrf = readCsrfToken();
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: csrf ? { 'X-CSRF-Token': csrf } : {},
      });
      if (!res.ok) {
        useSessionStore.getState().clear();
        return false;
      }
      return true;
    } catch {
      useSessionStore.getState().clear();
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

/**
 * Typed fetch around the standard envelope. Attaches the bearer token,
 * transparently refreshes once on 401, and throws `ApiError` on failure so
 * callers (and TanStack Query) get a consistent, user-facing error surface.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const { method = 'GET', body, auth = true, signal, _isRetry = false } = options;
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  // Double-submit CSRF: echo the readable csrf cookie on state-changing calls.
  if (MUTATING_METHODS.has(method.toUpperCase())) {
    const csrf = readCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      // Auth rides httpOnly cookies; always send them (same-origin).
      credentials: 'include',
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw NETWORK_ERROR;
  }

  // Attempt one silent cookie refresh + retry on an expired access token.
  if (res.status === 401 && auth && !_isRetry) {
    const renewed = await refreshAccessToken();
    if (renewed) {
      return apiFetch<T>(path, { ...options, _isRetry: true });
    }
  }

  let envelope: ApiEnvelope<T>;
  try {
    envelope = (await res.json()) as ApiEnvelope<T>;
  } catch {
    throw new ApiError(
      'INVALID_RESPONSE',
      'El servidor devolvió una respuesta inesperada.',
      res.status,
    );
  }

  if (!res.ok || !envelope.success) {
    const err = envelope.error ?? {
      code: 'UNKNOWN_ERROR',
      message: 'Ocurrió un error inesperado.',
    };
    throw new ApiError(err.code, err.message, res.status, err.details);
  }

  return envelope.data;
}
