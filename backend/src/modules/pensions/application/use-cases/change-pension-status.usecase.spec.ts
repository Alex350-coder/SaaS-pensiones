import { Prisma } from '@prisma/client';
import { AuditService } from '../../../../core/audit/audit.service';
import { RestaurantsService } from '../../../catalog/application/restaurants.service';
import { PensionSnapshot, PensionStatus } from '../../domain/pension';
import { Clock } from '../ports/clock.port';
import {
  LockedPensionOps,
  PensionRepository,
  PensionWithParties,
} from '../ports/pension.repository';
import { ChangePensionStatusUseCase } from './change-pension-status.usecase';

const TODAY = new Date('2026-07-05T00:00:00.000Z');

const fakeClock: Clock = {
  now: () => new Date('2026-07-05T15:30:00.000Z'),
  todayUtc: () => TODAY,
};

interface FakeState {
  pension: PensionSnapshot;
  confirmedPayments: number;
}

const withParties = (pension: PensionSnapshot): PensionWithParties => ({
  ...pension,
  client: { id: pension.clientId, fullName: 'Cliente', email: 'c@x.dev' },
  restaurant: { id: pension.restaurantId, name: 'R', slug: 'r' },
});

interface BuiltUseCase {
  useCase: ChangePensionStatusUseCase;
  issuer: { issueForPayment: jest.Mock; voidForPension: jest.Mock };
  audit: { record: jest.Mock };
}

/** Builds the use case with in-memory fakes, capturing the issuer mock. */
const build = (state: FakeState): BuiltUseCase => {
  const ops: LockedPensionOps = {
    tx: {} as unknown as Prisma.TransactionClient,
    getPension: () => Promise.resolve({ ...state.pension }),
    sumConfirmedPayments: () => Promise.resolve(state.confirmedPayments),
    createConfirmedPayment: () => Promise.reject(new Error('unused')),
    activate: () => Promise.reject(new Error('unused')),
    updateStatus: (status) => {
      state.pension = { ...state.pension, status };
      return Promise.resolve({ ...state.pension });
    },
    voidConfirmedPayments: () => {
      const voided = state.confirmedPayments > 0 ? 1 : 0;
      state.confirmedPayments = 0;
      return Promise.resolve(voided);
    },
  };

  const repo = {
    findForClient: () => Promise.resolve(withParties(state.pension)),
    findForRestaurant: () => Promise.resolve(withParties(state.pension)),
    withLockedPension: <T>(_id: string, fn: (o: LockedPensionOps) => Promise<T>) =>
      fn(ops),
  } as unknown as PensionRepository;

  const restaurants = {
    getOwnRestaurantId: jest.fn().mockResolvedValue('rest-1'),
  } as unknown as RestaurantsService;

  const issuer = {
    issueForPayment: jest.fn(),
    voidForPension: jest.fn().mockResolvedValue(1),
  };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };

  const useCase = new ChangePensionStatusUseCase(
    repo,
    fakeClock,
    issuer,
    restaurants,
    audit as unknown as AuditService,
  );
  return { useCase, issuer, audit };
};

const pension = (status: PensionStatus): PensionSnapshot => ({
  id: 'pen-1',
  clientId: 'client-1',
  restaurantId: 'rest-1',
  startDate: TODAY,
  endDate: new Date('2026-08-04T00:00:00.000Z'),
  price: 300,
  status,
  createdAt: TODAY,
});

describe('ChangePensionStatusUseCase — invoice voiding', () => {
  it('voids the invoices when a prepaid pension is cancelled', async () => {
    const state = { pension: pension('PENDING_PAYMENT'), confirmedPayments: 100 };
    const { useCase, issuer, audit } = build(state);

    const result = await useCase.cancelAsClient('client-1', 'pen-1');

    expect(result.status).toBe('CANCELLED');
    expect(issuer.voidForPension).toHaveBeenCalledTimes(1);
    expect(issuer.voidForPension).toHaveBeenCalledWith(
      expect.anything(),
      'pen-1',
    );
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'pension.status_changed',
        metadata: expect.objectContaining({
          voidedPayments: 1,
          voidedInvoices: 1,
        }),
      }),
    );
  });

  it('does not touch invoices when cancelling a prepaid pension with no payments', async () => {
    const state = { pension: pension('PENDING_PAYMENT'), confirmedPayments: 0 };
    const { useCase, issuer, audit } = build(state);

    await useCase.cancelAsClient('client-1', 'pen-1');

    expect(issuer.voidForPension).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ voidedInvoices: 0 }),
      }),
    );
  });

  it('does not void payments or invoices when the restaurant cancels an ACTIVE pension', async () => {
    const state = { pension: pension('ACTIVE'), confirmedPayments: 300 };
    const { useCase, issuer } = build(state);

    const result = await useCase.changeAsRestaurant('owner-1', 'pen-1', 'CANCELLED');

    expect(result.status).toBe('CANCELLED');
    // Service was delivered — payments and their invoices are kept.
    expect(issuer.voidForPension).not.toHaveBeenCalled();
    expect(state.confirmedPayments).toBe(300);
  });
});
