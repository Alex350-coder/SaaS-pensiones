import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AuthSession } from '@/lib/api-types';
import { useIsAuthenticated, useSessionStore } from '@/stores/session-store';
import * as authApi from './api';
import type { LoginValues, RegisterValues } from './schemas';

/**
 * Validate the persisted session against the server. A revoked/expired token
 * that survives refresh makes `apiFetch` clear the session, so this doubles as
 * a rehydration guard on app load. Disabled when there is no session.
 */
export function useMe() {
  const isAuthenticated = useIsAuthenticated();
  return useQuery({
    queryKey: ['auth', 'me'],
    queryFn: authApi.getMe,
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });
}

/** Login mutation — persists the session on success. */
export function useLogin() {
  const setSession = useSessionStore((s) => s.setSession);
  return useMutation<AuthSession, Error, LoginValues>({
    mutationFn: authApi.login,
    onSuccess: (session) => setSession(session),
  });
}

/** Registration mutation — persists the session on success. */
export function useRegister() {
  const setSession = useSessionStore((s) => s.setSession);
  return useMutation<AuthSession, Error, RegisterValues>({
    mutationFn: authApi.register,
    onSuccess: (session) => setSession(session),
  });
}

/**
 * Logout: best-effort server revocation, then always clear local state and
 * drop cached queries so no stale private data lingers after sign-out.
 */
export function useLogout() {
  const queryClient = useQueryClient();
  const clear = useSessionStore((s) => s.clear);

  return useMutation<void, Error, void>({
    mutationFn: async () => {
      // A failed revocation must not block the user from signing out locally.
      await authApi.logout().catch(() => undefined);
    },
    onSettled: () => {
      clear();
      queryClient.clear();
    },
  });
}
