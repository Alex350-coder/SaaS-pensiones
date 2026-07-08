import { Navigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { RegisterForm } from '@/features/auth/components/RegisterForm';
import { safeRedirect } from '@/features/auth/safe-redirect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useIsAuthenticated } from '@/stores/session-store';

export function RegisterPage() {
  useDocumentTitle('Crear cuenta');
  const [searchParams] = useSearchParams();
  const redirectTo = safeRedirect(searchParams.get('redirect'));
  const isAuthenticated = useIsAuthenticated();

  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Empieza a contratar pensiones o a ofrecerlas en minutos."
    >
      <RegisterForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
