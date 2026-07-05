import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '@prisma/client';
import { AuthUser } from './auth-user';
import { IS_PUBLIC_KEY } from './public.decorator';
import { ROLES_KEY } from './roles.decorator';

/**
 * Global RBAC guard, deny by default: a non-@Public route must declare
 * @Roles explicitly or every request is rejected. Runs after JwtAuthGuard,
 * so `request.user` is always present here.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }

    const allowedRoles = this.reflector.getAllAndOverride<
      UserRole[] | undefined
    >(ROLES_KEY, [context.getHandler(), context.getClass()]);

    const { user } = context
      .switchToHttp()
      .getRequest<{ user?: AuthUser }>();

    if (!allowedRoles || allowedRoles.length === 0 || !user) {
      // Missing @Roles is a wiring bug, not a client error — fail closed.
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tienes permisos para realizar esta acción.',
      });
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'No tienes permisos para realizar esta acción.',
      });
    }

    return true;
  }
}
