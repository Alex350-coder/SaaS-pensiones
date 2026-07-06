import { AttendanceStatus, PensionStatus } from '@prisma/client';
import { addUtcDays, formatUtcDate, todayUtc } from '../../../core/dates/utc-date';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { AttendanceService } from './attendance.service';

const today = todayUtc();

const pensionRow = (
  status: PensionStatus = PensionStatus.ACTIVE,
): Record<string, unknown> => ({
  id: 'pension-1',
  restaurantId: 'rest-1',
  status,
  startDate: addUtcDays(today, -5),
  endDate: addUtcDays(today, 25),
});

const attendanceRow = (): Record<string, unknown> => ({
  id: 'att-1',
  pensionId: 'pension-1',
  restaurantId: 'rest-1',
  attendanceDate: today,
  status: AttendanceStatus.WILL_ATTEND,
  confirmedAt: new Date(),
  updatedAt: new Date(),
});

interface TxMock {
  $queryRaw: jest.Mock;
  pension: { findFirst: jest.Mock };
  attendance: { upsert: jest.Mock };
}

const buildService = (): { service: AttendanceService; tx: TxMock } => {
  const tx: TxMock = {
    $queryRaw: jest.fn().mockResolvedValue([]),
    pension: { findFirst: jest.fn() },
    attendance: { upsert: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn((arg: unknown) =>
      typeof arg === 'function'
        ? (arg as (t: TxMock) => Promise<unknown>)(tx)
        : Promise.all(arg as []),
    ),
    attendance: { count: jest.fn(), findMany: jest.fn() },
  };
  const service = new AttendanceService(prisma as unknown as PrismaService);
  return { service, tx };
};

describe('AttendanceService', () => {
  it('upserts the answer under the pension row lock', async () => {
    const { service, tx } = buildService();
    tx.pension.findFirst.mockResolvedValue(pensionRow());
    tx.attendance.upsert.mockResolvedValue(attendanceRow());

    const view = await service.confirm('client-1', {
      pensionId: 'pension-1',
      date: formatUtcDate(today),
      status: AttendanceStatus.WILL_ATTEND,
    });

    expect(tx.$queryRaw).toHaveBeenCalled();
    const upsert = tx.attendance.upsert.mock.calls[0][0];
    expect(upsert.where.pensionId_attendanceDate).toEqual({
      pensionId: 'pension-1',
      attendanceDate: today,
    });
    expect(upsert.create.restaurantId).toBe('rest-1');
    expect(view.status).toBe(AttendanceStatus.WILL_ATTEND);
  });

  it("404s a pension that is not the client's", async () => {
    const { service, tx } = buildService();
    tx.pension.findFirst.mockResolvedValue(null);

    await expect(
      service.confirm('intruder', {
        pensionId: 'pension-1',
        date: formatUtcDate(today),
        status: AttendanceStatus.WILL_ATTEND,
      }),
    ).rejects.toMatchObject({ response: { code: 'PENSION_NOT_FOUND' } });
    expect(tx.attendance.upsert).not.toHaveBeenCalled();
  });

  it('409s when the pension is not ACTIVE (invariant #4)', async () => {
    const { service, tx } = buildService();
    tx.pension.findFirst.mockResolvedValue(
      pensionRow(PensionStatus.SUSPENDED),
    );

    await expect(
      service.confirm('client-1', {
        pensionId: 'pension-1',
        date: formatUtcDate(today),
        status: AttendanceStatus.WILL_NOT_ATTEND,
      }),
    ).rejects.toMatchObject({ response: { code: 'PENSION_NOT_ACTIVE' } });
  });

  it('409s a date outside the coverage period (invariant #1)', async () => {
    const { service, tx } = buildService();
    tx.pension.findFirst.mockResolvedValue(pensionRow());

    await expect(
      service.confirm('client-1', {
        pensionId: 'pension-1',
        date: formatUtcDate(addUtcDays(today, 40)),
        status: AttendanceStatus.WILL_ATTEND,
      }),
    ).rejects.toMatchObject({
      response: { code: 'ATTENDANCE_OUT_OF_PERIOD' },
    });
  });

  it('409s past dates', async () => {
    const { service, tx } = buildService();
    tx.pension.findFirst.mockResolvedValue(pensionRow());

    await expect(
      service.confirm('client-1', {
        pensionId: 'pension-1',
        date: formatUtcDate(addUtcDays(today, -1)),
        status: AttendanceStatus.WILL_ATTEND,
      }),
    ).rejects.toMatchObject({ response: { code: 'ATTENDANCE_DATE_PAST' } });
  });
});
