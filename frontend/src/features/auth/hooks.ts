import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { AuthSession } from '@/lib/api-types';
import { useSessionStore } from '@/stores/session-store';
import * as authApi from './api';
import type { LoginValues, RegisterValues } from './schemas';

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
      const refreshToken = useSessionStore.getState().tokens?.refreshToken;
      if (refreshToken) {
        // A failed revocation must not block the user from signing out locally.
        await authApi.logout(refreshToken).catch(() => undefined);
      }
    },
    onSettled: () => {
      clear();
      queryClient.clear();
    },
  });
}
