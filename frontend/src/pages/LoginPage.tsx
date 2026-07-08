import { Navigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { safeRedirect } from '@/features/auth/safe-redirect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useIsAuthenticated } from '@/stores/session-store';

export function LoginPage() {
  useDocumentTitle('Ingresar');
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  return (
    <AuthShell
      title="Bienvenido de nuevo"
      subtitle="Ingresa para gestionar tu pensión y tus reservas."
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
