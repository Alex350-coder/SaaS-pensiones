import { describe, expect, it } from 'vitest';
import { ApiError } from './api-client';
import { queryClient } from './query-client';

describe('queryClient retry policy', () => {
  const retry = queryClient.getDefaultOptions().queries!.retry as (
    count: number,
    error: unknown,
  ) => boolean;

  it('never retries 4xx ApiErrors', () => {
    expect(retry(0, new ApiError('NOT_FOUND', 'x', 404))).toBe(false);
    expect(retry(0, new ApiError('FORBIDDEN', 'x', 403))).toBe(false);
  });

  it('retries transient failures once', () => {
    const err = new ApiError('SERVER', 'x', 500);
    expect(retry(0, err)).toBe(true);
    expect(retry(1, err)).toBe(false);
  });

  it('retries non-ApiError (network) once', () => {
    expect(retry(0, new Error('boom'))).toBe(true);
    expect(retry(1, new Error('boom'))).toBe(false);
  });

  it('disables mutation retries', () => {
    expect(queryClient.getDefaultOptions().mutations!.retry).toBe(false);
  });
});
