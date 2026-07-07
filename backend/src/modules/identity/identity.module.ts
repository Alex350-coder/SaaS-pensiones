import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AdminUsersService } from './application/admin-users.service';
import { AuthService } from './application/auth.service';
import { PasswordService } from './application/password.service';
import { RefreshTokenService } from './application/refresh-token.service';
import { TokenService } from './application/token.service';
import { AdminUsersController } from './presentation/admin-users.controller';
import { AuthController } from './presentation/auth.controller';

/** Identity & Access bounded context: registration, login, tokens, RBAC data. */
@Module({
  imports: [CoreModule],
  controllers: [AuthController, AdminUsersController],
  providers: [
    AuthService,
    PasswordService,
    RefreshTokenService,
    TokenService,
    AdminUsersService,
  ],
  exports: [TokenService],
})
export class IdentityModule {}
