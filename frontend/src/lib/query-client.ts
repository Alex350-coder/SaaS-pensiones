import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api-client';

/**
 * Don't retry client errors (4xx) — a 404/403 won't fix itself; only retry
 * transient network/server failures, and only once.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 1;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
