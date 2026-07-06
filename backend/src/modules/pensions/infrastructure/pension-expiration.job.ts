import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpirePensionsUseCase } from '../application/use-cases/expire-pensions.usecase';

/**
 * Daily expiration sweep, shortly after UTC midnight (pension days are UTC
 * calendar days). The use case is idempotent, so overlapping or repeated
 * runs are harmless.
 */
@Injectable()
export class PensionExpirationJob {
  private readonly logger = new Logger(PensionExpirationJob.name);

  constructor(private readonly expirePensions: ExpirePensionsUseCase) {}

  @Cron('5 0 * * *', { name: 'pension-expiration', timeZone: 'UTC' })
  async run(): Promise<void> {
    try {
      await this.expirePensions.execute();
    } catch (error) {
      // A failed sweep must not crash the app; the next run catches up.
      this.logger.error(
        'Pension expiration sweep failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
