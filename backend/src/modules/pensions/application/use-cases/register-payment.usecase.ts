import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditService } from '../../../../core/audit/audit.service';
import { RestaurantsService } from '../../../catalog/application/restaurants.service';
import { activationPeriod } from '../../domain/pension-dates';
import { assertTransition } from '../../domain/pension-status.machine';
import { CLOCK, Clock } from '../ports/clock.port';
import {
  INVOICE_ISSUER,
  InvoiceIssuer,
  IssuedInvoice,
} from '../ports/invoice-issuer.port';
import {
  PaymentSnapshot,
  PENSION_REPOSITORY,
  PensionRepository,
} from '../ports/pension.repository';
import {
  PaymentView,
  PensionView,
  rethrowDomainError,
  toCents,
  toPaymentView,
  toPensionView,
} from '../pension-view';

export interface RegisterPaymentInput {
  amount: number;
  method: PaymentSnapshot['method'];
  paidAt?: Date;
}

export interface RegisterPaymentResult {
  pension: PensionView;
  payment: PaymentView;
  paidTotal: number;
  activated: boolean;
  /** Present only when this payment activated the pension (one invoice/pension). */
  invoice?: IssuedInvoice;
}

/**
 * The restaurant registers a (simulated) payment against a PENDING_PAYMENT
 * pension. Partial payments accumulate; when confirmed payments reach the
 * price, the pension activates: startDate = today, endDate = +30 days.
 * Everything runs under the pension row lock — two concurrent payments
 * cannot both activate or overshoot the balance.
 */
@Injectable()
export class RegisterPaymentUseCase {
  constructor(
    @Inject(PENSION_REPOSITORY) private readonly pensions: PensionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    @Inject(INVOICE_ISSUER) private readonly invoiceIssuer: InvoiceIssuer,
    private readonly restaurants: RestaurantsService,
    private readonly audit: AuditService,
  ) {}

  async execute(
    ownerId: string,
    pensionId: string,
    input: RegisterPaymentInput,
  ): Promise<RegisterPaymentResult> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const existing = await this.pensions.findForRestaurant(
      pensionId,
      restaurantId,
    );
    if (!existing) {
      throw new NotFoundException({
        code: 'PENSION_NOT_FOUND',
        message: 'La pensión no existe.',
      });
    }

    // paidAt documents when the money changed hands; it must stay inside
    // the pension's real timeline (it will feed invoice history later).
    if (input.paidAt) {
      const skewMs = 5 * 60 * 1000;
      if (
        input.paidAt.getTime() > this.clock.now().getTime() + skewMs ||
        input.paidAt.getTime() < existing.createdAt.getTime()
      ) {
        throw new BadRequestException({
          code: 'INVALID_PAID_AT',
          message:
            'La fecha de pago no puede ser futura ni anterior a la contratación.',
        });
      }
    }

    const outcome = await this.pensions
      .withLockedPension(pensionId, async (ops) => {
        const pension = await ops.getPension();
        if (!pension || pension.status !== 'PENDING_PAYMENT') {
          throw new ConflictException({
            code: 'PENSION_NOT_PAYABLE',
            message: 'Solo se registran pagos de pensiones pendientes de pago.',
          });
        }

        const paidCents = toCents(await ops.sumConfirmedPayments());
        const priceCents = toCents(pension.price);
        const amountCents = toCents(input.amount);
        const balanceCents = priceCents - paidCents;

        if (amountCents > balanceCents) {
          throw new BadRequestException({
            code: 'PAYMENT_EXCEEDS_BALANCE',
            message: `El pago excede el saldo pendiente (${(balanceCents / 100).toFixed(2)}).`,
          });
        }

        const payment = await ops.createConfirmedPayment({
          amount: input.amount,
          method: input.method,
          paidAt: input.paidAt ?? this.clock.now(),
          registeredById: ownerId,
        });

        const paidTotalCents = paidCents + amountCents;
        let activated = false;
        let invoice: IssuedInvoice | undefined;
        if (paidTotalCents >= priceCents) {
          assertTransition('SYSTEM', pension.status, 'ACTIVE');
          // Clock read INSIDE the lock: even if acquisition straddles UTC
          // midnight, the activation day is the commit day.
          const period = activationPeriod(this.clock.todayUtc());
          await ops.activate(period.startDate, period.endDate);
          activated = true;
          // Emit the invoice in the SAME transaction (same lock): the
          // correlative number is assigned atomically, and a rollback of the
          // activation rolls back the invoice too — never a gap.
          invoice = await this.invoiceIssuer.issueForPayment(ops.tx, {
            paymentId: payment.id,
            restaurantId,
            total: pension.price,
          });
        }

        return { payment, paidTotal: paidTotalCents / 100, activated, invoice };
      })
      .catch(rethrowDomainError);

    await this.audit.record({
      actorId: ownerId,
      action: 'pension.payment_registered',
      entityType: 'pension',
      entityId: pensionId,
      metadata: { amount: input.amount, method: input.method },
    });
    if (outcome.activated) {
      await this.audit.record({
        actorId: ownerId,
        action: 'pension.activated',
        entityType: 'pension',
        entityId: pensionId,
        metadata: { paidTotal: outcome.paidTotal },
      });
    }
    if (outcome.invoice) {
      await this.audit.record({
        actorId: ownerId,
        action: 'invoice.issued',
        entityType: 'invoice',
        entityId: outcome.invoice.id,
        metadata: {
          pensionId,
          series: outcome.invoice.series,
          number: outcome.invoice.number,
        },
      });
    }

    const fresh = await this.pensions.findForRestaurant(
      pensionId,
      restaurantId,
    );
    if (!fresh) {
      throw new NotFoundException({
        code: 'PENSION_NOT_FOUND',
        message: 'La pensión no existe.',
      });
    }
    return {
      pension: toPensionView(fresh, this.clock.todayUtc()),
      payment: toPaymentView(outcome.payment),
      paidTotal: outcome.paidTotal,
      activated: outcome.activated,
      invoice: outcome.invoice,
    };
  }
}
