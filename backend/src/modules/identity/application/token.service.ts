import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UserRole } from '@prisma/client';
import { AccessTokenPayload } from '../../../core/auth/auth-user';

@Injectable()
export class TokenService {
  constructor(private readonly jwtService: JwtService) {}

  /** Minimal payload by design: sub + role, nothing personal (security.md §4). */
  signAccessToken(userId: string, role: UserRole): Promise<string> {
    const payload: AccessTokenPayload = { sub: userId, role };
    return this.jwtService.signAsync(payload);
  }
}
