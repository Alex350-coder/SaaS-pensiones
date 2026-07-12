import { Navigate, Outlet } from 'react-router-dom';
import type { UserRole } from '@/lib/api-types';
import { roleHomePath } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';

/**
 * Restrict a subtree to specific roles. A signed-in user with the wrong role is
 * redirected to their own area (never a dead end); a signed-out user falls back
 * to login. Client-side gating for UX — the API is the real authority.
 */
export function RequireRole({ allow }: { allow: readonly UserRole[] }) {
  const user = useSessionStore((s) => s.user);

  if (!user) return <Navigate to="/ingresar" replace />;
  if (!allow.includes(user.role)) {
    return <Navigate to={roleHomePath(user.role)} replace />;
  }

  return <Outlet />;
}
