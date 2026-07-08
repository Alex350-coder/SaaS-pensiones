import { zodResolver } from '@hookform/resolvers/zod';
import { AlertCircle, Store, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { PasswordField } from '@/components/forms/PasswordField';
import { TextField } from '@/components/forms/TextField';
import { Button } from '@/components/ui/button';
import { ApiError } from '@/lib/api-client';
import type { UserRole } from '@/lib/api-types';
import { cn } from '@/lib/utils';
import { useRegister } from '../hooks';
import { registerSchema, type RegisterValues } from '../schemas';

const ROLE_OPTIONS: { value: Extract<UserRole, 'CLIENT' | 'RESTAURANT_ADMIN'>; label: string; hint: string; icon: typeof User }[] = [
  { value: 'CLIENT', label: 'Soy cliente', hint: 'Quiero contratar una pensión', icon: User },
  { value: 'RESTAURANT_ADMIN', label: 'Tengo un restaurante', hint: 'Quiero ofrecer pensiones', icon: Store },
];

export function RegisterForm({ redirectTo = '/' }: { redirectTo?: string }) {
  const navigate = useNavigate();
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
    defaultValues: { role: 'CLIENT' },
  });

  const selectedRole = watch('role');

  const onSubmit = (values: RegisterValues) => {
    registerMutation.mutate(values, {
      onSuccess: (session) => {
        toast.success(`¡Bienvenido/a, ${session.user.fullName.split(' ')[0]}!`);
        navigate(redirectTo, { replace: true });
      },
      onError: (error) => {
        if (error instanceof ApiError && /EMAIL/i.test(error.code)) {
          setError('email', { message: error.message });
          return;
        }
        const message =
          error instanceof ApiError
            ? error.message
            : 'No pudimos crear tu cuenta. Inténtalo de nuevo.';
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

      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm font-medium text-text">
          ¿Cómo usarás Pensiones?
        </legend>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {ROLE_OPTIONS.map((option) => {
            const Icon = option.icon;
            const active = selectedRole === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() =>
                  setValue('role', option.value, { shouldValidate: true })
                }
                aria-pressed={active}
                className={cn(
                  'flex items-start gap-3 rounded-md border p-3.5 text-left transition-colors duration-fast focus-visible:outline-none focus-visible:shadow-focus-ring',
                  active
                    ? 'border-primary bg-primary-soft'
                    : 'border-border bg-surface hover:border-primary/40',
                )}
              >
                <span
                  className={cn(
                    'flex size-9 shrink-0 items-center justify-center rounded-full',
                    active ? 'bg-primary text-primary-foreground' : 'bg-surface-raised text-text-muted',
                  )}
                >
                  <Icon className="size-[1.125rem]" aria-hidden="true" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text">
                    {option.label}
                  </span>
                  <span className="block text-xs text-text-muted">{option.hint}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <TextField
        id="fullName"
        label="Nombre completo"
        autoComplete="name"
        placeholder="Ej. María Torres"
        required
        registration={register('fullName')}
        error={errors.fullName?.message}
      />

      <TextField
        id="email"
        label="Correo electrónico"
        type="email"
        inputMode="email"
        autoComplete="email"
        placeholder="tu@correo.com"
        required
        registration={register('email')}
        error={errors.email?.message}
      />

      <TextField
        id="phone"
        label="Teléfono"
        type="tel"
        inputMode="tel"
        autoComplete="tel"
        placeholder="+51 999 111 222"
        hint="Opcional"
        registration={register('phone')}
        error={errors.phone?.message}
      />

      <PasswordField
        id="password"
        label="Contraseña"
        autoComplete="new-password"
        hint="Mínimo 8 caracteres."
        required
        registration={register('password')}
        error={errors.password?.message}
      />

      <PasswordField
        id="confirmPassword"
        label="Confirmar contraseña"
        autoComplete="new-password"
        required
        registration={register('confirmPassword')}
        error={errors.confirmPassword?.message}
      />

      <Button
        type="submit"
        size="lg"
        className="w-full"
        loading={registerMutation.isPending}
      >
        Crear cuenta
      </Button>

      <p className="text-center text-sm text-text-muted">
        ¿Ya tienes cuenta?{' '}
        <Link to="/ingresar" className="font-medium text-primary hover:underline">
          Ingresar
        </Link>
      </p>
    </form>
  );
}
