import { apiFetch } from '@/lib/api-client';
import type { AuthSession, MeUser } from '@/lib/api-types';
import type { LoginValues, RegisterValues } from './schemas';

/** Current user from the access token — used to validate/rehydrate the session. */
export function getMe(): Promise<MeUser> {
  return apiFetch<MeUser>('/auth/me');
}

export function login(values: LoginValues): Promise<AuthSession> {
  return apiFetch<AuthSession>('/auth/login', {
    method: 'POST',
    auth: false,
    body: values,
  });
}

export function register(values: RegisterValues): Promise<AuthSession> {
  // Only send what the backend expects; drop the UX-only confirmation field
  // and omit empty optional phone.
  const payload = {
    fullName: values.fullName,
    email: values.email,
    password: values.password,
    role: values.role,
    ...(values.phone ? { phone: values.phone } : {}),
  };
  return apiFetch<AuthSession>('/auth/register', {
    method: 'POST',
    auth: false,
    body: payload,
  });
}

export function logout(refreshToken: string): Promise<null> {
  return apiFetch<null>('/auth/logout', {
    method: 'POST',
    body: { refreshToken },
  });
}
