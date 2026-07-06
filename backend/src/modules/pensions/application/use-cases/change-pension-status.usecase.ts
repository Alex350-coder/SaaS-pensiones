import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { AuditService } from '../../../../core/audit/audit.service';
import { RestaurantsService } from '../../../catalog/application/restaurants.service';
import { PensionStatus } from '../../domain/pension';
import {
  assertTransition,
  PensionActor,
} from '../../domain/pension-status.machine';
import { CLOCK, Clock } from '../ports/clock.port';
import {
  PENSION_REPOSITORY,
  PensionRepository,
} from '../ports/pension.repository';
import { PensionView, rethrowDomainError, toPensionView } from '../pension-view';

const pensionNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'PENSION_NOT_FOUND',
    message: 'La pensión no existe.',
  });

/**
 * Actor-aware status transitions under the pension row lock. Reactivating a
 * SUSPENDED pension keeps its dates: suspension never extends the period.
 */
@Injectable()
export class ChangePensionStatusUseCase {
  constructor(
    @Inject(PENSION_REPOSITORY) private readonly pensions: PensionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly restaurants: RestaurantsService,
    private readonly audit: AuditService,
  ) {}

  /** A client cancels their own PENDING_PAYMENT pension. */
  async cancelAsClient(clientId: string, pensionId: string): Promise<PensionView> {
    const found = await this.pensions.findForClient(pensionId, clientId);
    if (!found) {
      throw pensionNotFoundError();
    }
    return this.transition('CLIENT', clientId, pensionId, 'CANCELLED', () =>
      this.pensions.findForClient(pensionId, clientId),
    );
  }

  /** The restaurant suspends / reactivates / cancels a pensioner. */
  async changeAsRestaurant(
    ownerId: string,
    pensionId: string,
    target: PensionStatus,
  ): Promise<PensionView> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const found = await this.pensions.findForRestaurant(pensionId, restaurantId);
    if (!found) {
      throw pensionNotFoundError();
    }
    return this.transition(
      'RESTAURANT_ADMIN',
      ownerId,
      pensionId,
      target,
      () => this.pensions.findForRestaurant(pensionId, restaurantId),
    );
  }

  private async transition(
    actor: PensionActor,
    actorId: string,
    pensionId: string,
    target: PensionStatus,
    refetch: () => Promise<unknown>,
  ): Promise<PensionView> {
    const outcome = await this.pensions
      .withLockedPension(pensionId, async (ops) => {
        const pension = await ops.getPension();
        if (!pension) {
          throw pensionNotFoundError();
        }
        assertTransition(actor, pension.status, target);

        // Cancelling a prepayment refunds it: confirmed payments are voided
        // in the same transaction. Cancelling ACTIVE/SUSPENDED keeps them —
        // the service was (partially) delivered; refunds are out of scope.
        let voidedPayments = 0;
        if (target === 'CANCELLED' && pension.status === 'PENDING_PAYMENT') {
          voidedPayments = await ops.voidConfirmedPayments();
        }

        await ops.updateStatus(target);
        return { fromStatus: pension.status, voidedPayments };
      })
      .catch(rethrowDomainError);

    await this.audit.record({
      actorId,
      action: 'pension.status_changed',
      entityType: 'pension',
      entityId: pensionId,
      metadata: {
        from: outcome.fromStatus,
        to: target,
        actor,
        voidedPayments: outcome.voidedPayments,
      },
    });

    const fresh = (await refetch()) as Parameters<typeof toPensionView>[0];
    return toPensionView(fresh, this.clock.todayUtc());
  }
}
