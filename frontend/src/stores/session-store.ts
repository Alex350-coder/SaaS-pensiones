import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthSession, SessionUser } from '@/lib/api-types';

interface SessionState {
  user: SessionUser | null;
  /** Set the current user after login/register. */
  setSession: (session: AuthSession) => void;
  /** Clear the session (logout, or a failed/expired refresh). */
  clear: () => void;
}

/**
 * Session state (current user only). Auth tokens live in httpOnly cookies the
 * browser manages — never in JS/`localStorage` (docs/security.md A2, closes
 * code-review C-1). The persisted `user` is a UX convenience for instant paint
 * on reload; `useMe` revalidates it against `/auth/me`, and the httpOnly
 * refresh cookie is what actually keeps the session alive across reloads.
 * Server data (restaurants, menus…) lives in TanStack Query, never here.
 */
export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      user: null,
      setSession: ({ user }) => set({ user }),
      clear: () => set({ user: null }),
    }),
    {
      name: 'pensiones.session',
      partialize: (state) => ({ user: state.user }),
    },
  ),
);

/** Convenience selector: is there an authenticated user? */
export const useIsAuthenticated = (): boolean =>
  useSessionStore((s) => s.user !== null);
