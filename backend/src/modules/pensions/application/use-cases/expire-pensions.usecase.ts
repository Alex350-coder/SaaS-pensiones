import { Inject, Injectable, Logger } from '@nestjs/common';
import { CLOCK, Clock } from '../ports/clock.port';
import {
  PENSION_REPOSITORY,
  PensionRepository,
} from '../ports/pension.repository';

/**
 * Bulk-expires ACTIVE pensions whose period ended (endDate <= today, UTC).
 * Idempotent: safe to run any number of times per day; driven by the daily
 * cron (infrastructure/pension-expiration.job.ts).
 */
@Injectable()
export class ExpirePensionsUseCase {
  private readonly logger = new Logger(ExpirePensionsUseCase.name);

  constructor(
    @Inject(PENSION_REPOSITORY) private readonly pensions: PensionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async execute(): Promise<number> {
    const today = this.clock.todayUtc();
    const expired = await this.pensions.expireDue(today);
    if (expired > 0) {
      this.logger.log(
        `Expired ${expired} pension(s) as of ${today.toISOString().slice(0, 10)}`,
      );
    }
    return expired;
  }
}
