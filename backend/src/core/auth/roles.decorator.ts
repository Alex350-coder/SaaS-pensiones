import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Declares which roles may call a route. Deny by default: a non-@Public
 * route WITHOUT @Roles is rejected by RolesGuard (docs/security.md §4 —
 * every endpoint demands an explicit role).
 */
export const Roles = (...roles: UserRole[]): MethodDecorator & ClassDecorator =>
  SetMetadata(ROLES_KEY, roles);
