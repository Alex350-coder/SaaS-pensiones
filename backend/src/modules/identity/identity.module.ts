import { Module } from '@nestjs/common';
import { CoreModule } from '../../core/core.module';
import { AuthService } from './application/auth.service';
import { PasswordService } from './application/password.service';
import { RefreshTokenService } from './application/refresh-token.service';
import { TokenService } from './application/token.service';
import { AuthController } from './presentation/auth.controller';

/** Identity & Access bounded context: registration, login, tokens, RBAC data. */
@Module({
  imports: [CoreModule],
  controllers: [AuthController],
  providers: [AuthService, PasswordService, RefreshTokenService, TokenService],
  exports: [TokenService],
})
export class IdentityModule {}
