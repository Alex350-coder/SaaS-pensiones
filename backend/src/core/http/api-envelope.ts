/**
 * Standard API envelope: every response is `{ success, data, error }`.
 * User-facing `message` is Spanish; `code` is a stable English slug.
 */
export interface ApiErrorBody {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  error: null;
}

export interface ApiErrorResponse {
  success: false;
  data: null;
  error: ApiErrorBody;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export function apiSuccess<T>(data: T): ApiSuccessResponse<T> {
  return { success: true, data, error: null };
}

export function apiError(
  code: string,
  message: string,
  details?: unknown,
): ApiErrorResponse {
  return {
    success: false,
    data: null,
    error: details === undefined ? { code, message } : { code, message, details },
  };
}

/** True when a controller already returned a fully-shaped envelope. */
export function isApiResponse(value: unknown): value is ApiResponse<unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    'success' in value &&
    'data' in value &&
    'error' in value &&
    typeof (value as { success: unknown }).success === 'boolean'
  );
}
