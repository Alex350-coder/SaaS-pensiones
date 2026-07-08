import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession, SessionUser, TokenPair } from '@/lib/api-types';

interface SessionState {
  user: SessionUser | null;
  tokens: TokenPair | null;
  /** Set the full session after login/register. */
  setSession: (session: AuthSession) => void;
  /** Replace only the token pair after a silent refresh rotation. */
  setTokens: (tokens: TokenPair) => void;
  /** Clear the session (logout, or a failed/expired refresh). */
  clear: () => void;
}

/**
 * Session state (current user + tokens). Persisted so a reload keeps the user
 * signed in. This is the ONLY client-side copy of the session — server data
 * (restaurants, menus…) lives in TanStack Query, never duplicated here.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      tokens: null,
      setSession: ({ user, accessToken, refreshToken }) =>
        set({ user, tokens: { accessToken, refreshToken } }),
      setTokens: (tokens) => set({ tokens }),
      clear: () => set({ user: null, tokens: null }),
    }),
    {
      name: 'pensiones.session',
      partialize: (state) => ({ user: state.user, tokens: state.tokens }),
    },
  ),
);

/** Convenience selector: is there an authenticated user? */
export const useIsAuthenticated = (): boolean =>
  useSessionStore((s) => s.user !== null && s.tokens !== null);
