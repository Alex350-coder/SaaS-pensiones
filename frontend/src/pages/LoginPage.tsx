import { Navigate, useSearchParams } from 'react-router-dom';
import { AuthShell } from '@/features/auth/components/AuthShell';
import { LoginForm } from '@/features/auth/components/LoginForm';
import { safeRedirect } from '@/features/auth/safe-redirect';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { roleHomePath } from '@/lib/roles';
import { useSessionStore } from '@/stores/session-store';

export function LoginPage() {
  useDocumentTitle('Ingresar');
  const [searchParams] = useSearchParams();
  const explicit = searchParams.get('redirect');
  const redirectTo = explicit ? safeRedirect(explicit) : null;
  const user = useSessionStore((s) => s.user);

  // Already signed in: honor an explicit redirect, else send to the role home.
  if (user) {
    return <Navigate to={redirectTo ?? roleHomePath(user.role)} replace />;
  }

  return (
    <AuthShell
      title="Bienvenido de nuevo"
      subtitle="Ingresa para gestionar tu pensión y tus reservas."
    >
      <LoginForm redirectTo={redirectTo} />
    </AuthShell>
  );
}
