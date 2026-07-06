import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../../../core/audit/audit.service';
import { RestaurantsService } from '../../../catalog/application/restaurants.service';
import { activationPeriod } from '../../domain/pension-dates';
import { CLOCK, Clock } from '../ports/clock.port';
import {
  PENSION_REPOSITORY,
  PensionRepository,
} from '../ports/pension.repository';
import { PensionView, rethrowDomainError, toPensionView } from '../pension-view';

/**
 * A CLIENT contracts a 30-day pension with an APPROVED restaurant. Born
 * PENDING_PAYMENT with tentative dates; the real period is set when the
 * payment completes. The "one live pension per client+restaurant" rule is
 * the DB partial unique — the repository surfaces it as a domain error.
 */
@Injectable()
export class ContractPensionUseCase {
  constructor(
    @Inject(PENSION_REPOSITORY) private readonly pensions: PensionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly restaurants: RestaurantsService,
    private readonly audit: AuditService,
  ) {}

  async execute(clientId: string, restaurantId: string): Promise<PensionView> {
    const restaurant =
      await this.restaurants.findContractableRestaurant(restaurantId);
    if (!restaurant) {
      throw new NotFoundException({
        code: 'RESTAURANT_NOT_FOUND',
        message: 'El restaurante no existe o no acepta pensiones.',
      });
    }

    const today = this.clock.todayUtc();
    const period = activationPeriod(today);

    let pensionId: string;
    try {
      const created = await this.pensions.create({
        clientId,
        restaurantId: restaurant.id,
        price: restaurant.monthlyPensionPrice,
        startDate: period.startDate,
        endDate: period.endDate,
      });
      pensionId = created.id;
    } catch (error) {
      rethrowDomainError(error);
    }

    await this.audit.record({
      actorId: clientId,
      action: 'pension.contracted',
      entityType: 'pension',
      entityId: pensionId,
      metadata: { restaurantId: restaurant.id, price: restaurant.monthlyPensionPrice },
    });

    const withParties = await this.pensions.findForClient(pensionId, clientId);
    // Just created by this client — always present.
    return toPensionView(withParties!, today);
  }
}
