import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  Restaurant,
  RestaurantImage,
  RestaurantSchedule,
  RestaurantStatus,
} from '@prisma/client';
import { AuditService } from '../../../core/audit/audit.service';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { CreateRestaurantDto } from '../presentation/dto/create-restaurant.dto';
import { ScheduleItemDto } from '../presentation/dto/update-schedules.dto';
import { UpdateRestaurantDto } from '../presentation/dto/update-restaurant.dto';
import { slugify } from './slugify';

const MAX_GALLERY_IMAGES = 12;
const SLUG_RETRY_LIMIT = 3;

/** Super Admin lifecycle (docs/roadmap.md F4): PENDING → APPROVED ⇄ SUSPENDED. */
const ALLOWED_TRANSITIONS: Record<RestaurantStatus, RestaurantStatus[]> = {
  [RestaurantStatus.PENDING]: [RestaurantStatus.APPROVED],
  [RestaurantStatus.APPROVED]: [RestaurantStatus.SUSPENDED],
  [RestaurantStatus.SUSPENDED]: [RestaurantStatus.APPROVED],
};

export interface PublicRestaurantListItem {
  id: string;
  name: string;
  slug: string;
  description: string;
  address: string;
  logoUrl: string | null;
  coverImageUrl: string | null;
  monthlyPensionPrice: number;
}

export interface ScheduleView {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
}

export interface ImageView {
  id: string;
  url: string;
  sortOrder: number;
}

const notFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'RESTAURANT_NOT_FOUND',
    message: 'El restaurante no existe.',
  });

const noOwnRestaurantError = (): NotFoundException =>
  new NotFoundException({
    code: 'RESTAURANT_NOT_FOUND',
    message: 'Todavía no registraste un restaurante.',
  });

/** Wall-clock 'HH:MM' <-> Postgres TIME (stored as 1970-01-01 UTC instants). */
const timeToDate = (time: string): Date => new Date(`1970-01-01T${time}:00Z`);
const dateToTime = (date: Date): string => date.toISOString().slice(11, 16);

@Injectable()
export class RestaurantsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  // --- Public catalog ------------------------------------------------------

  async listPublic(
    query: PaginationQueryDto,
  ): Promise<Paginated<PublicRestaurantListItem>> {
    // Exit criterion F4: PENDING/SUSPENDED never reach the public catalog.
    const where = { status: RestaurantStatus.APPROVED, deletedAt: null };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.restaurant.count({ where }),
      this.prisma.restaurant.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(rows.map((row) => this.toPublicItem(row)), total, query);
  }

  async getPublicBySlug(slug: string): Promise<
    PublicRestaurantListItem & {
      contactPhone: string;
      contactEmail: string;
      latitude: number | null;
      longitude: number | null;
      images: ImageView[];
      schedules: ScheduleView[];
    }
  > {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { slug, status: RestaurantStatus.APPROVED, deletedAt: null },
      include: {
        images: { orderBy: { sortOrder: 'asc' } },
        schedules: { orderBy: { dayOfWeek: 'asc' } },
      },
    });
    if (!restaurant) {
      throw notFoundError();
    }
    return this.toDetail(restaurant);
  }

  // --- Owner (RESTAURANT_ADMIN) --------------------------------------------

  async createOwn(
    ownerId: string,
    dto: CreateRestaurantDto,
  ): Promise<ReturnType<RestaurantsService['toOwnerView']>> {
    const existing = await this.prisma.restaurant.findFirst({
      where: { ownerId, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw this.alreadyExistsError();
    }

    const baseSlug = slugify(dto.name) || 'restaurante';
    for (let attempt = 0; attempt < SLUG_RETRY_LIMIT; attempt++) {
      const slug =
        attempt === 0
          ? baseSlug
          : `${baseSlug}-${Math.random().toString(36).slice(2, 6)}`;
      try {
        const created = await this.prisma.restaurant.create({
          data: {
            ownerId,
            slug,
            name: dto.name,
            description: dto.description,
            address: dto.address,
            contactPhone: dto.contactPhone,
            contactEmail: dto.contactEmail,
            monthlyPensionPrice: dto.monthlyPensionPrice,
            latitude: dto.latitude ?? null,
            longitude: dto.longitude ?? null,
            logoUrl: dto.logoUrl ?? null,
            coverImageUrl: dto.coverImageUrl ?? null,
          },
        });
        await this.audit.record({
          actorId: ownerId,
          action: 'restaurant.created',
          entityType: 'restaurant',
          entityId: created.id,
          metadata: { slug: created.slug },
        });
        return this.toOwnerView(created);
      } catch (error) {
        if (this.violates(error, 'uq_restaurants_owner_live')) {
          throw this.alreadyExistsError();
        }
        if (this.violates(error, 'uq_restaurants_slug_live')) {
          continue; // collision with another live slug: retry with suffix
        }
        throw error;
      }
    }
    throw new ConflictException({
      code: 'SLUG_UNAVAILABLE',
      message: 'No se pudo generar una URL única para el restaurante.',
    });
  }

  async getOwn(ownerId: string): Promise<
    ReturnType<RestaurantsService['toOwnerView']> & {
      images: ImageView[];
      schedules: ScheduleView[];
    }
  > {
    const restaurant = await this.findOwn(ownerId, {
      images: { orderBy: { sortOrder: 'asc' } },
      schedules: { orderBy: { dayOfWeek: 'asc' } },
    });
    return {
      ...this.toOwnerView(restaurant),
      images: restaurant.images.map((image) => this.toImageView(image)),
      schedules: restaurant.schedules.map((s) => this.toScheduleView(s)),
    };
  }

  async updateOwn(
    ownerId: string,
    dto: UpdateRestaurantDto,
  ): Promise<ReturnType<RestaurantsService['toOwnerView']>> {
    const restaurant = await this.findOwn(ownerId);
    const updated = await this.prisma.restaurant.update({
      where: { id: restaurant.id },
      data: this.toColumns(dto),
    });
    return this.toOwnerView(updated);
  }

  /** Full weekly replacement inside one transaction. */
  async replaceSchedules(
    ownerId: string,
    items: ScheduleItemDto[],
  ): Promise<ScheduleView[]> {
    const days = items.map((item) => item.dayOfWeek);
    if (new Set(days).size !== days.length) {
      throw new BadRequestException({
        code: 'DUPLICATE_SCHEDULE_DAY',
        message: 'Hay más de un horario para el mismo día.',
      });
    }
    for (const item of items) {
      if (item.opensAt >= item.closesAt) {
        throw new BadRequestException({
          code: 'INVALID_SCHEDULE_RANGE',
          message: 'La hora de apertura debe ser anterior a la de cierre.',
        });
      }
    }

    const restaurant = await this.findOwn(ownerId);
    await this.prisma.$transaction([
      this.prisma.restaurantSchedule.deleteMany({
        where: { restaurantId: restaurant.id },
      }),
      this.prisma.restaurantSchedule.createMany({
        data: items.map((item) => ({
          restaurantId: restaurant.id,
          dayOfWeek: item.dayOfWeek,
          opensAt: timeToDate(item.opensAt),
          closesAt: timeToDate(item.closesAt),
        })),
      }),
    ]);

    const schedules = await this.prisma.restaurantSchedule.findMany({
      where: { restaurantId: restaurant.id },
      orderBy: { dayOfWeek: 'asc' },
    });
    return schedules.map((s) => this.toScheduleView(s));
  }

  async addImage(ownerId: string, url: string): Promise<ImageView> {
    const restaurant = await this.findOwn(ownerId);
    const count = await this.prisma.restaurantImage.count({
      where: { restaurantId: restaurant.id },
    });
    if (count >= MAX_GALLERY_IMAGES) {
      throw new ConflictException({
        code: 'GALLERY_FULL',
        message: `La galería admite máximo ${MAX_GALLERY_IMAGES} imágenes.`,
      });
    }
    const last = await this.prisma.restaurantImage.aggregate({
      where: { restaurantId: restaurant.id },
      _max: { sortOrder: true },
    });
    try {
      const image = await this.prisma.restaurantImage.create({
        data: {
          restaurantId: restaurant.id,
          url,
          sortOrder: (last._max.sortOrder ?? -1) + 1,
        },
      });
      return this.toImageView(image);
    } catch (error) {
      // Concurrent uploads can race for the same sortOrder; the unique
      // constraint keeps integrity, we surface it as a retryable conflict.
      if (this.isUniqueViolation(error)) {
        throw new ConflictException({
          code: 'IMAGE_CONFLICT',
          message: 'La galería cambió mientras subías la imagen. Intenta de nuevo.',
        });
      }
      throw error;
    }
  }

  async removeImage(ownerId: string, imageId: string): Promise<void> {
    const restaurant = await this.findOwn(ownerId);
    // Ownership enforced structurally: the delete is scoped to own restaurant.
    const result = await this.prisma.restaurantImage.deleteMany({
      where: { id: imageId, restaurantId: restaurant.id },
    });
    if (result.count === 0) {
      throw new NotFoundException({
        code: 'IMAGE_NOT_FOUND',
        message: 'La imagen no existe.',
      });
    }
  }

  /**
   * Structural-ownership helper for downstream contexts (Menu, Pensions…):
   * resolves the caller's live restaurant id from the JWT identity, so other
   * modules never accept a client-supplied restaurant id for owner actions.
   */
  async getOwnRestaurantId(ownerId: string): Promise<string> {
    const restaurant = await this.findOwn(ownerId);
    return restaurant.id;
  }

  // --- Super Admin ----------------------------------------------------------

  async adminList(
    query: PaginationQueryDto,
    status?: RestaurantStatus,
  ): Promise<Paginated<ReturnType<RestaurantsService['toOwnerView']>>> {
    const where = { deletedAt: null, ...(status ? { status } : {}) };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.restaurant.count({ where }),
      this.prisma.restaurant.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(rows.map((row) => this.toOwnerView(row)), total, query);
  }

  async changeStatus(
    actorId: string,
    restaurantId: string,
    target: RestaurantStatus,
  ): Promise<ReturnType<RestaurantsService['toOwnerView']>> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { id: restaurantId, deletedAt: null },
    });
    if (!restaurant) {
      throw notFoundError();
    }

    if (!ALLOWED_TRANSITIONS[restaurant.status].includes(target)) {
      throw new ConflictException({
        code: 'INVALID_STATUS_TRANSITION',
        message: `No se puede pasar de ${restaurant.status} a ${target}.`,
      });
    }

    const updated = await this.prisma.restaurant.update({
      where: { id: restaurant.id },
      data: { status: target },
    });
    await this.audit.record({
      actorId,
      action: 'restaurant.status_changed',
      entityType: 'restaurant',
      entityId: restaurant.id,
      metadata: { from: restaurant.status, to: target },
    });
    return this.toOwnerView(updated);
  }

  // --- Internals -------------------------------------------------------------

  private async findOwn(ownerId: string): Promise<Restaurant>;
  private async findOwn<I extends Prisma.RestaurantInclude>(
    ownerId: string,
    include: I,
  ): Promise<Prisma.RestaurantGetPayload<{ include: I }>>;
  private async findOwn(
    ownerId: string,
    include?: Prisma.RestaurantInclude,
  ): Promise<unknown> {
    const restaurant = await this.prisma.restaurant.findFirst({
      where: { ownerId, deletedAt: null },
      ...(include ? { include } : {}),
    });
    if (!restaurant) {
      throw noOwnRestaurantError();
    }
    return restaurant;
  }

  /** PATCH semantics: undefined fields are dropped, present ones updated. */
  private toColumns(dto: UpdateRestaurantDto): Prisma.RestaurantUpdateInput {
    const entries = Object.entries({
      name: dto.name,
      description: dto.description,
      address: dto.address,
      contactPhone: dto.contactPhone,
      contactEmail: dto.contactEmail,
      monthlyPensionPrice: dto.monthlyPensionPrice,
      latitude: dto.latitude,
      longitude: dto.longitude,
      logoUrl: dto.logoUrl,
      coverImageUrl: dto.coverImageUrl,
    }).filter(([, value]) => value !== undefined);
    return Object.fromEntries(entries);
  }

  private toPublicItem(row: Restaurant): PublicRestaurantListItem {
    return {
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description,
      address: row.address,
      logoUrl: row.logoUrl,
      coverImageUrl: row.coverImageUrl,
      monthlyPensionPrice: Number(row.monthlyPensionPrice),
    };
  }

  private toDetail(
    row: Restaurant & {
      images: RestaurantImage[];
      schedules: RestaurantSchedule[];
    },
  ): PublicRestaurantListItem & {
    contactPhone: string;
    contactEmail: string;
    latitude: number | null;
    longitude: number | null;
    images: ImageView[];
    schedules: ScheduleView[];
  } {
    return {
      ...this.toPublicItem(row),
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      images: row.images.map((image) => this.toImageView(image)),
      schedules: row.schedules.map((s) => this.toScheduleView(s)),
    };
  }

  private toOwnerView(row: Restaurant): PublicRestaurantListItem & {
    status: RestaurantStatus;
    contactPhone: string;
    contactEmail: string;
    latitude: number | null;
    longitude: number | null;
    createdAt: Date;
  } {
    return {
      ...this.toPublicItem(row),
      status: row.status,
      contactPhone: row.contactPhone,
      contactEmail: row.contactEmail,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
      createdAt: row.createdAt,
    };
  }

  private toScheduleView(row: RestaurantSchedule): ScheduleView {
    return {
      dayOfWeek: row.dayOfWeek,
      opensAt: dateToTime(row.opensAt),
      closesAt: dateToTime(row.closesAt),
    };
  }

  private toImageView(row: RestaurantImage): ImageView {
    return { id: row.id, url: row.url, sortOrder: row.sortOrder };
  }

  private alreadyExistsError(): ConflictException {
    return new ConflictException({
      code: 'RESTAURANT_ALREADY_EXISTS',
      message: 'Ya tienes un restaurante registrado.',
    });
  }

  /** Schema-level unique violations (project convention: code, not message). */
  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }

  /**
   * Raw-SQL partial unique indexes (live-rows-only) don't surface as P2002
   * with a usable target, so the constraint name in the message is the
   * only discriminator — same fallback as AuthService.isUniqueViolation.
   */
  private violates(error: unknown, constraint: string): boolean {
    return error instanceof Error && error.message.includes(constraint);
  }
}
