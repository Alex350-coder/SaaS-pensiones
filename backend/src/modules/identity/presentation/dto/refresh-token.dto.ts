import { IsString, Length } from 'class-validator';

/** Body for both POST /auth/refresh and POST /auth/logout. */
export class RefreshTokenDto {
  @IsString()
  @Length(20, 200)
  refreshToken!: string;
}
