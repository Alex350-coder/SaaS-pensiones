import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Attendance } from '@prisma/client';
import { formatUtcDate, parseUtcDate, todayUtc } from '../../../core/dates/utc-date';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PrismaService } from '../../../core/prisma/prisma.service';
import {
  attendanceViolation,
  AttendanceRuleViolation,
} from '../domain/attendance-rules';
import {
  ConfirmAttendanceDto,
  ListAttendanceQueryDto,
} from '../presentation/dto/attendance.dto';

export interface AttendanceView {
  id: string;
  pensionId: string;
  restaurantId: string;
  date: string;
  status: Attendance['status'];
  confirmedAt: Date;
}

const RULE_ERRORS: Record<AttendanceRuleViolation, () => ConflictException> = {
  PENSION_NOT_ACTIVE: () =>
    new ConflictException({
      code: 'PENSION_NOT_ACTIVE',
      message: 'Solo una pensión activa puede confirmar asistencia.',
    }),
  ATTENDANCE_OUT_OF_PERIOD: () =>
    new ConflictException({
      code: 'ATTENDANCE_OUT_OF_PERIOD',
      message: 'La fecha está fuera del período de la pensión.',
    }),
  ATTENDANCE_DATE_PAST: () =>
    new ConflictException({
      code: 'ATTENDANCE_DATE_PAST',
      message: 'No se puede confirmar asistencia para una fecha pasada.',
    }),
};

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Upserts the pensioner's answer for one day. The pension row is locked
   * FOR UPDATE while checking invariants #1/#4 (docs/database-design.md §4),
   * so a concurrent suspension/cancellation (pensions module locks the same
   * row) serializes with the check. UNIQUE(pension_id, attendance_date)
   * makes the write itself an atomic upsert.
   */
  async confirm(
    clientId: string,
    dto: ConfirmAttendanceDto,
  ): Promise<AttendanceView> {
    const date = parseUtcDate(dto.date);
    const today = todayUtc();

    const attendance = await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM pensions WHERE id = ${dto.pensionId}::uuid FOR UPDATE`;

      const pension = await tx.pension.findFirst({
        where: { id: dto.pensionId, clientId },
        select: {
          id: true,
          restaurantId: true,
          status: true,
          startDate: true,
          endDate: true,
        },
      });
      if (!pension) {
        throw new NotFoundException({
          code: 'PENSION_NOT_FOUND',
          message: 'La pensión no existe.',
        });
      }

      // PENDING_PAYMENT dates are tentative, but the ACTIVE-only rule below
      // already rejects those pensions before the period check matters.
      const violation = attendanceViolation({
        pension: {
          status: pension.status,
          startDate: pension.startDate,
          endDate: pension.endDate,
        },
        date,
        today,
      });
      if (violation) {
        throw RULE_ERRORS[violation]();
      }

      return tx.attendance.upsert({
        where: {
          pensionId_attendanceDate: {
            pensionId: pension.id,
            attendanceDate: date,
          },
        },
        create: {
          pensionId: pension.id,
          restaurantId: pension.restaurantId,
          attendanceDate: date,
          status: dto.status,
        },
        update: { status: dto.status, confirmedAt: new Date() },
      });
    });

    return this.toView(attendance);
  }

  async listMine(
    clientId: string,
    query: ListAttendanceQueryDto,
  ): Promise<Paginated<AttendanceView>> {
    const where = {
      pension: { clientId, id: query.pensionId },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.attendance.count({ where }),
      this.prisma.attendance.findMany({
        where,
        orderBy: [{ attendanceDate: 'desc' }, { id: 'desc' }],
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(rows.map((row) => this.toView(row)), total, query);
  }

  private toView(attendance: Attendance): AttendanceView {
    return {
      id: attendance.id,
      pensionId: attendance.pensionId,
      restaurantId: attendance.restaurantId,
      date: formatUtcDate(attendance.attendanceDate),
      status: attendance.status,
      confirmedAt: attendance.confirmedAt,
    };
  }
}
