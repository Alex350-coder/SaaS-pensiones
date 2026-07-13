import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DailyMenu,
  MenuStatus,
  PensionStatus,
  Prisma,
  Reservation,
  ReservationStatus,
  RestaurantStatus,
} from '@prisma/client';
import { formatUtcDate, parseUtcDate, todayUtc } from '../../../core/dates/utc-date';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import {
  reservationChangeViolation,
  reservationCreateViolation,
  ReservationRuleViolation,
} from '../domain/reservation-rules';
import {
  CreateReservationDto,
  ListReservationsQueryDto,
  RestaurantDayQueryDto,
  UpdateReservationDto,
} from '../presentation/dto/reservation.dto';
import { arrivalTimeFromDb, arrivalTimeToDb } from './arrival-time';

type ReservationWithMenu = Reservation & {
  dailyMenu: DailyMenu & { restaurant: { id: string; name: string; slug: string } };
};

type ReservationWithClient = Reservation & {
  dailyMenu: DailyMenu;
  client: { id: string; fullName: string; email: string };
};

export interface ClientReservationView {
  id: string;
  status: ReservationStatus;
  menuDate: string;
  estimatedArrival: string;
  notes: string | null;
  pensionId: string | null;
  restaurant: { id: string; name: string; slug: string };
  createdAt: Date;
}

export interface RestaurantReservationView {
  id: string;
  status: ReservationStatus;
  menuDate: string;
  estimatedArrival: string;
  notes: string | null;
  pensionId: string | null;
  client: { id: string; fullName: string; email: string };
}

const reservationNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'RESERVATION_NOT_FOUND',
    message: 'La reserva no existe.',
  });

const menuNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'MENU_NOT_FOUND',
    message: 'El menú no existe o no está disponible.',
  });

const RULE_ERRORS: Record<ReservationRuleViolation, () => ConflictException> = {
  RESERVATION_DATE_PAST: () =>
    new ConflictException({
      code: 'RESERVATION_DATE_PAST',
      message: 'No se puede reservar un menú de una fecha pasada.',
    }),
  NO_ACTIVE_PENSION: () =>
    new ConflictException({
      code: 'NO_ACTIVE_PENSION',
      message:
        'Necesitas una pensión activa en este restaurante que cubra esa fecha.',
    }),
  RESERVATION_NOT_MODIFIABLE: () =>
    new ConflictException({
      code: 'RESERVATION_NOT_MODIFIABLE',
      message: 'La reserva ya no se puede modificar ni cancelar.',
    }),
};

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
  ) {}

  // --- Client ------------------------------------------------------------------

  /**
   * Reserves the day's menu for a pensioner. The menu row is locked FOR
   * UPDATE so a concurrent unpublish (menu module takes the same lock)
   * serializes with us — invariant #3 (reservations only against PUBLISHED
   * menus) holds under concurrency. The one-live-reservation-per-client+menu
   * exit criterion lives in the DB partial unique, not here.
   */
  async create(
    clientId: string,
    dto: CreateReservationDto,
  ): Promise<ClientReservationView> {
    const today = todayUtc();
    try {
      const reservation = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM daily_menus WHERE id = ${dto.dailyMenuId}::uuid FOR UPDATE`;

        const menu = await tx.dailyMenu.findFirst({
          where: {
            id: dto.dailyMenuId,
            status: MenuStatus.PUBLISHED,
            restaurant: { status: RestaurantStatus.APPROVED, deletedAt: null },
          },
          select: { id: true, menuDate: true, restaurantId: true },
        });
        if (!menu) {
          // DRAFT menus and non-approved restaurants look nonexistent on
          // purpose: the public surface never revealed them either.
          throw menuNotFoundError();
        }

        const pension = await tx.pension.findFirst({
          where: {
            clientId,
            restaurantId: menu.restaurantId,
            status: PensionStatus.ACTIVE,
          },
          select: { id: true, status: true, startDate: true, endDate: true },
        });

        const violation = reservationCreateViolation({
          menuDate: menu.menuDate,
          today,
          pension,
        });
        if (violation) {
          throw RULE_ERRORS[violation]();
        }
        // Unreachable: a null pension yields the NO_ACTIVE_PENSION violation
        // above. Kept as an explicit type guard so `pension.id` needs no
        // non-null assertion.
        if (!pension) {
          throw RULE_ERRORS.NO_ACTIVE_PENSION();
        }

        return tx.reservation.create({
          data: {
            clientId,
            dailyMenuId: menu.id,
            pensionId: pension.id,
            estimatedArrival: arrivalTimeToDb(dto.estimatedArrival),
            notes: dto.notes,
          },
          include: { dailyMenu: { include: { restaurant: { select: { id: true, name: true, slug: true } } } } },
        });
      });
      return this.toClientView(reservation);
    } catch (error) {
      // uq_live_reservation_per_client_menu — exit criterion F7 lives in the DB.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException({
          code: 'RESERVATION_ALREADY_EXISTS',
          message: 'Ya tienes una reserva para ese menú.',
        });
      }
      throw error;
    }
  }

  async listMine(
    clientId: string,
    query: ListReservationsQueryDto,
  ): Promise<Paginated<ClientReservationView>> {
    const where = { clientId, status: query.status };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        include: {
          dailyMenu: {
            include: { restaurant: { select: { id: true, name: true, slug: true } } },
          },
        },
        orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(rows.map((row) => this.toClientView(row)), total, query);
  }

  async getMine(
    clientId: string,
    reservationId: string,
  ): Promise<ClientReservationView> {
    const reservation = await this.findMine(clientId, reservationId);
    return this.toClientView(reservation);
  }

  async update(
    clientId: string,
    reservationId: string,
    dto: UpdateReservationDto,
  ): Promise<ClientReservationView> {
    const reservation = await this.findMine(clientId, reservationId);
    this.assertModifiable(reservation);

    // Same atomic guard as cancel(): re-asserting CONFIRMED in the WHERE
    // closes the race with a concurrent cancel between the check above and
    // this write.
    const { count } = await this.prisma.reservation.updateMany({
      where: {
        id: reservation.id,
        clientId,
        status: ReservationStatus.CONFIRMED,
      },
      data: {
        estimatedArrival:
          dto.estimatedArrival !== undefined
            ? arrivalTimeToDb(dto.estimatedArrival)
            : undefined,
        notes: dto.notes,
      },
    });
    if (count === 0) {
      throw RULE_ERRORS.RESERVATION_NOT_MODIFIABLE();
    }
    return this.getMine(clientId, reservationId);
  }

  /** Cancelling frees the partial-unique slot: the client may reserve again. */
  async cancel(
    clientId: string,
    reservationId: string,
  ): Promise<ClientReservationView> {
    const reservation = await this.findMine(clientId, reservationId);
    this.assertModifiable(reservation);

    // Guarding status in the WHERE makes the transition atomic: two
    // concurrent cancels (or a future FULFILLED marker) cannot both win.
    const { count } = await this.prisma.reservation.updateMany({
      where: {
        id: reservation.id,
        clientId,
        status: ReservationStatus.CONFIRMED,
      },
      data: { status: ReservationStatus.CANCELLED },
    });
    if (count === 0) {
      throw RULE_ERRORS.RESERVATION_NOT_MODIFIABLE();
    }
    return this.getMine(clientId, reservationId);
  }

  // --- Restaurant ----------------------------------------------------------------

  /** Reservas del día for the owner's restaurant, ordered by arrival time. */
  async listForRestaurantDay(
    ownerId: string,
    query: RestaurantDayQueryDto,
  ): Promise<Paginated<RestaurantReservationView>> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const menuDate = query.date ? parseUtcDate(query.date) : todayUtc();
    const where = {
      status: query.status,
      dailyMenu: { restaurantId, menuDate },
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        include: {
          dailyMenu: true,
          client: { select: { id: true, fullName: true, email: true } },
        },
        orderBy: [{ estimatedArrival: 'asc' }, { id: 'asc' }],
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(
      rows.map((row) => this.toRestaurantView(row)),
      total,
      query,
    );
  }

  // --- Internals -------------------------------------------------------------------

  private async findMine(
    clientId: string,
    reservationId: string,
  ): Promise<ReservationWithMenu> {
    const reservation = await this.prisma.reservation.findFirst({
      where: { id: reservationId, clientId },
      include: {
        dailyMenu: {
          include: { restaurant: { select: { id: true, name: true, slug: true } } },
        },
      },
    });
    if (!reservation) {
      throw reservationNotFoundError();
    }
    return reservation;
  }

  private assertModifiable(reservation: ReservationWithMenu): void {
    const violation = reservationChangeViolation({
      status: reservation.status,
      menuDate: reservation.dailyMenu.menuDate,
      today: todayUtc(),
    });
    if (violation) {
      throw RULE_ERRORS[violation]();
    }
  }

  private toClientView(reservation: ReservationWithMenu): ClientReservationView {
    return {
      id: reservation.id,
      status: reservation.status,
      menuDate: formatUtcDate(reservation.dailyMenu.menuDate),
      estimatedArrival: arrivalTimeFromDb(reservation.estimatedArrival),
      notes: reservation.notes,
      pensionId: reservation.pensionId,
      restaurant: reservation.dailyMenu.restaurant,
      createdAt: reservation.createdAt,
    };
  }

  private toRestaurantView(
    reservation: ReservationWithClient,
  ): RestaurantReservationView {
    return {
      id: reservation.id,
      status: reservation.status,
      menuDate: formatUtcDate(reservation.dailyMenu.menuDate),
      estimatedArrival: arrivalTimeFromDb(reservation.estimatedArrival),
      notes: reservation.notes,
      pensionId: reservation.pensionId,
      client: reservation.client,
    };
  }
}
