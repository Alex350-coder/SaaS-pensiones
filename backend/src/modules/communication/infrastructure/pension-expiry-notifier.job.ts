import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ExpiringPensionsNotifierService } from '../application/expiring-pensions-notifier.service';

/**
 * Runs after the Pensions expiration sweep (00:05 UTC) so pensions that just
 * expired are already out of ACTIVE and never warned post-mortem. The sweep
 * is idempotent, so repeated or overlapping runs are harmless.
 */
@Injectable()
export class PensionExpiryNotifierJob {
  private readonly logger = new Logger(PensionExpiryNotifierJob.name);

  constructor(private readonly notifier: ExpiringPensionsNotifierService) {}

  @Cron('15 0 * * *', { name: 'pension-expiry-notifications', timeZone: 'UTC' })
  async run(): Promise<void> {
    try {
      await this.notifier.sweep();
    } catch (error) {
      // A failed sweep must not crash the app; the next run catches up.
      this.logger.error(
        'Pension expiry notification sweep failed',
        error instanceof Error ? error.stack : undefined,
      );
    }
  }
}
