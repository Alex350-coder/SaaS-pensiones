import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { RefreshTokenService } from '../application/refresh-token.service';

/**
 * Daily housekeeping: drop refresh tokens past their expiry so the table does
 * not grow unbounded with dead rows. `purgeExpired` is idempotent, so repeated
 * or overlapping runs are harmless.
 */
@Injectable()
export class RefreshTokenPurgeJob {
  private readonly logger = new Logger(RefreshTokenPurgeJob.name);

  constructor(private readonly refreshTokens: RefreshTokenService) {}

  @Cron('30 3 * * *', { name: 'refresh-token-purge', timeZone: 'UTC' })
  async run(): Promise<void> {
    try {
      const removed = await this.refreshTokens.purgeExpired();
      if (removed > 0) {
        this.logger.log(`Purged ${removed} expired refresh token(s)`);
      }
    } catch (error) {
      // A failed purge must not crash the app; the next run catches up.
      this.logger.error(
        'Refresh token purge failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
