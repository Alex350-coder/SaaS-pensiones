import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useIsAuthenticated } from '@/stores/session-store';

/**
 * Gate for authenticated routes. Unauthenticated visitors are sent to login
 * with a `redirect` back to where they were headed. This is a UX gate only —
 * the API enforces authorization independently on every request.
 */
export function RequireAuth() {
  const isAuthenticated = useIsAuthenticated();
  const location = useLocation();

  if (!isAuthenticated) {
    const target = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/ingresar?redirect=${target}`} replace />;
  }

  return <Outlet />;
}
