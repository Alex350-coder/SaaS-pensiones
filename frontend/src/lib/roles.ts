import type { UserRole } from '@/lib/api-types';

/** Base path of each role's private area. */
export const ROLE_HOME: Record<UserRole, string> = {
  CLIENT: '/app',
  RESTAURANT_ADMIN: '/panel',
  SUPER_ADMIN: '/admin',
};

/** Landing route for a role after authentication. */
export function roleHomePath(role: UserRole): string {
  return ROLE_HOME[role];
}

/** Human label for a role (Spanish UI copy). */
export const ROLE_LABELS: Record<UserRole, string> = {
  CLIENT: 'Cliente',
  RESTAURANT_ADMIN: 'Restaurante',
  SUPER_ADMIN: 'Administrador',
};

/** Chat route for a role, or null for roles without chat (Super Admin). */
export function messagesPath(role: UserRole): string | null {
  switch (role) {
    case 'CLIENT':
      return '/app/mensajes';
    case 'RESTAURANT_ADMIN':
      return '/panel/mensajes';
    case 'SUPER_ADMIN':
      return null;
  }
}
