import { UserRole } from '@prisma/client';

/** Authenticated principal attached to the request by JwtAuthGuard. */
export interface AuthUser {
  userId: string;
  role: UserRole;
}

/** JWT payload shape: minimal on purpose (docs/security.md §4). */
export interface AccessTokenPayload {
  sub: string;
  role: UserRole;
}
