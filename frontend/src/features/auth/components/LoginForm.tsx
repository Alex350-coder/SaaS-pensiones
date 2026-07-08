import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import { useLogin } from '../hooks';
import { loginSchema, type LoginValues } from '../schemas';

export function LoginForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const login = useLogin();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    mode: 'onBlur',
  });

  const onSubmit = (values: LoginValues) => {
    login.mutate(values, {
      onSuccess: (session) => {
        toast.success(`Hola de nuevo, ${session.user.fullName.split(' ')[0]}.`);
        navigate(redirectTo, { replace: true });
      },
      onError: (error) => {
        const message =
          error instanceof ApiError
            ? error.message
            : 'No pudimos iniciar sesión. Inténtalo de nuevo.';
        setError('root.server', { message });
      },
    });
  };

  const serverError = errors.root?.server?.message;

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
      {serverError && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-md border border-danger/30 bg-danger-soft px-3.5 py-3 text-sm text-danger"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <span>{serverError}</span>
        </div>
      )}

      <TextField
        id="email"
        label="Correo electrónico"
        type="email"
        inputMode="email"
        autoComplete="username"
        placeholder="tu@correo.com"
        required
        registration={register('email')}
        error={errors.email?.message}
      />

      <PasswordField
        id="password"
        label="Contraseña"
        autoComplete="current-password"
        required
        registration={register('password')}
        error={errors.password?.message}
      />

      <Button type="submit" size="lg" className="w-full" loading={login.isPending}>
        Ingresar
      </Button>

      <p className="text-center text-sm text-text-muted">
        ¿No tienes cuenta?{' '}
        <Link to="/registro" className="font-medium text-primary hover:underline">
          Crear cuenta
        </Link>
      </p>
    </form>
  );
}
