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
  /** Send the access token (default: true). Public endpoints can opt out. */
  auth?: boolean;
  signal?: AbortSignal;
  /** Internal: prevents infinite refresh recursion. */
  _isRetry?: boolean;
}

// Single-flight refresh: concurrent 401s share one refresh round-trip.
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const { tokens, setTokens, clear } = useSessionStore.getState();
  if (!tokens?.refreshToken) return null;

  refreshPromise ??= (async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: tokens.refreshToken }),
      });
      const envelope = (await res.json()) as ApiEnvelope<{
        accessToken: string;
        refreshToken: string;
      }>;
      if (!res.ok || !envelope.success) {
        clear();
        return null;
      }
      setTokens(envelope.data);
      return envelope.data.accessToken;
    } catch {
      clear();
      return null;
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

  const accessToken = useSessionStore.getState().tokens?.accessToken;
  if (auth && accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw NETWORK_ERROR;
  }

  // Attempt one silent refresh + retry on an expired access token.
  if (res.status === 401 && auth && accessToken && !_isRetry) {
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
