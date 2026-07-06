import { AuditService } from '../../../../core/audit/audit.service';
import { RestaurantsService } from '../../../catalog/application/restaurants.service';
import { PensionSnapshot } from '../../domain/pension';
import { Clock } from '../ports/clock.port';
import {
  LockedPensionOps,
  PaymentSnapshot,
  PensionRepository,
} from '../ports/pension.repository';
import { RegisterPaymentUseCase } from './register-payment.usecase';

const TODAY = new Date('2026-07-05T00:00:00.000Z');

const fakeClock: Clock = {
  now: () => new Date('2026-07-05T15:30:00.000Z'),
  todayUtc: () => TODAY,
};

interface FakeState {
  pension: PensionSnapshot;
  confirmedTotal: number;
  payments: PaymentSnapshot[];
}

/** In-memory fake of the repository port (application tested without Prisma). */
const buildFakes = (
  state: FakeState,
): { repo: PensionRepository; audit: { record: jest.Mock } } => {
  const withParties = (): PensionSnapshot & {
    client: { id: string; fullName: string; email: string };
    restaurant: { id: string; name: string; slug: string };
  } => ({
    ...state.pension,
    client: { id: state.pension.clientId, fullName: 'Cliente', email: 'c@x.dev' },
    restaurant: { id: state.pension.restaurantId, name: 'R', slug: 'r' },
  });

  const ops: LockedPensionOps = {
    getPension: () => Promise.resolve({ ...state.pension }),
    sumConfirmedPayments: () => Promise.resolve(state.confirmedTotal),
    createConfirmedPayment: (input) => {
      const payment: PaymentSnapshot = {
        id: `pay-${state.payments.length + 1}`,
        pensionId: state.pension.id,
        amount: input.amount,
        method: input.method,
        status: 'CONFIRMED',
        paidAt: input.paidAt,
        registeredById: input.registeredById,
      };
      state.payments.push(payment);
      state.confirmedTotal += input.amount;
      return Promise.resolve(payment);
    },
    activate: (startDate, endDate) => {
      state.pension = { ...state.pension, status: 'ACTIVE', startDate, endDate };
      return Promise.resolve({ ...state.pension });
    },
    updateStatus: (status) => {
      state.pension = { ...state.pension, status };
      return Promise.resolve({ ...state.pension });
    },
    voidConfirmedPayments: () => {
      const voided = state.payments.filter((p) => p.status === 'CONFIRMED');
      voided.forEach((p) => (p.status = 'VOIDED'));
      state.confirmedTotal = 0;
      return Promise.resolve(voided.length);
    },
  };

  const repo = {
    findForRestaurant: () => Promise.resolve(withParties()),
    withLockedPension: <T>(_id: string, fn: (o: LockedPensionOps) => Promise<T>) =>
      fn(ops),
    listPayments: () => Promise.resolve(state.payments),
    sumConfirmedPayments: () => Promise.resolve(state.confirmedTotal),
  } as unknown as PensionRepository;

  return { repo, audit: { record: jest.fn().mockResolvedValue(undefined) } };
};

const buildUseCase = (
  state: FakeState,
): { useCase: RegisterPaymentUseCase; audit: { record: jest.Mock } } => {
  const { repo, audit } = buildFakes(state);
  const restaurants = {
    getOwnRestaurantId: jest.fn().mockResolvedValue('rest-1'),
  } as unknown as RestaurantsService;
  return {
    useCase: new RegisterPaymentUseCase(
      repo,
      fakeClock,
      restaurants,
      audit as unknown as AuditService,
    ),
    audit,
  };
};

const pendingPension = (): FakeState => ({
  pension: {
    id: 'pen-1',
    clientId: 'client-1',
    restaurantId: 'rest-1',
    startDate: TODAY,
    endDate: new Date('2026-08-04T00:00:00.000Z'),
    price: 300,
    status: 'PENDING_PAYMENT',
    createdAt: TODAY,
  },
  confirmedTotal: 0,
  payments: [],
});

describe('RegisterPaymentUseCase', () => {
  it('records a partial payment without activating', async () => {
    const state = pendingPension();
    const { useCase, audit } = buildUseCase(state);

    const result = await useCase.execute('owner-1', 'pen-1', {
      amount: 100,
      method: 'CASH',
    });

    expect(result.activated).toBe(false);
    expect(result.paidTotal).toBe(100);
    expect(state.pension.status).toBe('PENDING_PAYMENT');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pension.payment_registered' }),
    );
    expect(audit.record).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pension.activated' }),
    );
  });

  it('activates when confirmed payments reach the price: start=today, end=+30', async () => {
    const state = pendingPension();
    state.confirmedTotal = 100.1;
    const { useCase, audit } = buildUseCase(state);

    const result = await useCase.execute('owner-1', 'pen-1', {
      amount: 199.9,
      method: 'TRANSFER',
    });

    expect(result.activated).toBe(true);
    expect(result.paidTotal).toBe(300);
    expect(state.pension.status).toBe('ACTIVE');
    expect(state.pension.startDate.toISOString()).toBe(
      '2026-07-05T00:00:00.000Z',
    );
    expect(state.pension.endDate.toISOString()).toBe(
      '2026-08-04T00:00:00.000Z',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'pension.activated' }),
    );
  });

  it('rejects a payment exceeding the outstanding balance', async () => {
    const state = pendingPension();
    state.confirmedTotal = 250;
    const { useCase } = buildUseCase(state);

    await expect(
      useCase.execute('owner-1', 'pen-1', { amount: 100, method: 'CASH' }),
    ).rejects.toMatchObject({ response: { code: 'PAYMENT_EXCEEDS_BALANCE' } });
    expect(state.payments).toHaveLength(0);
  });

  it('rejects payments on a non-PENDING_PAYMENT pension', async () => {
    const state = pendingPension();
    state.pension.status = 'ACTIVE';
    const { useCase } = buildUseCase(state);

    await expect(
      useCase.execute('owner-1', 'pen-1', { amount: 300, method: 'CASH' }),
    ).rejects.toMatchObject({ response: { code: 'PENSION_NOT_PAYABLE' } });
  });

  it('handles float-hostile amounts via cents math', async () => {
    const state = pendingPension();
    state.pension.price = 0.3;
    state.confirmedTotal = 0.1;
    const { useCase } = buildUseCase(state);

    // 0.1 + 0.2 !== 0.3 in floats; in cents it activates exactly.
    const result = await useCase.execute('owner-1', 'pen-1', {
      amount: 0.2,
      method: 'CASH',
    });

    expect(result.activated).toBe(true);
  });
});
