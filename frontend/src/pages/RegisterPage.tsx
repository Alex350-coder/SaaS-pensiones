import { Navigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { RegisterForm } from '@/features/auth/components/RegisterForm';
import { safeRedirect } from '@/features/auth/safe-redirect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { roleHomePath } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';

export function RegisterPage() {
  useDocumentTitle('Crear cuenta');
  const [searchParams] = useSearchParams();
  const explicit = searchParams.get('redirect');
  const redirectTo = explicit ? safeRedirect(explicit) : null;
  const user = useSessionStore((s) => s.user);

  if (user) {
    return <Navigate to={redirectTo ?? roleHomePath(user.role)} replace />;
  }

  return (
    <AuthShell
      title="Crea tu cuenta"
      subtitle="Empieza a contratar pensiones o a ofrecerlas en minutos."
    >
      <RegisterForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
