import { Inject, Injectable, NotFoundException } from '@nestjs/common';
import { addUtcDays } from '../../../core/dates/utc-date';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { PensionStatus } from '../domain/pension';
import { CLOCK, Clock } from './ports/clock.port';
import {
  PENSION_REPOSITORY,
  PensionRepository,
  PensionWithParties,
} from './ports/pension.repository';
import {
  PaymentView,
  PensionView,
  toPaymentView,
  toPensionView,
} from './pension-view';

export interface PensionDetailView extends PensionView {
  paidTotal: number;
  payments: PaymentView[];
}

const pensionNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'PENSION_NOT_FOUND',
    message: 'La pensión no existe.',
  });

interface PageQuery {
  page: number;
  limit: number;
  skip: number;
}

@Injectable()
export class PensionQueriesService {
  constructor(
    @Inject(PENSION_REPOSITORY) private readonly pensions: PensionRepository,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly restaurants: RestaurantsService,
  ) {}

  async listMine(
    clientId: string,
    query: PageQuery,
    status?: PensionStatus,
  ): Promise<Paginated<PensionView>> {
    const page = await this.pensions.listByClient(
      clientId,
      { status },
      { skip: query.skip, take: query.limit },
    );
    return this.toPage(page.items, page.total, query);
  }

  async getMine(clientId: string, pensionId: string): Promise<PensionDetailView> {
    const pension = await this.pensions.findForClient(pensionId, clientId);
    if (!pension) {
      throw pensionNotFoundError();
    }
    return this.toDetail(pension);
  }

  async listForRestaurant(
    ownerId: string,
    query: PageQuery,
    status?: PensionStatus,
  ): Promise<Paginated<PensionView>> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const page = await this.pensions.listByRestaurant(
      restaurantId,
      { status },
      { skip: query.skip, take: query.limit },
    );
    return this.toPage(page.items, page.total, query);
  }

  /** Vencimientos: ACTIVE pensions ending within the next `days` days. */
  async listExpiring(
    ownerId: string,
    days: number,
    query: PageQuery,
  ): Promise<Paginated<PensionView>> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const today = this.clock.todayUtc();
    const page = await this.pensions.listExpiring(
      restaurantId,
      today,
      addUtcDays(today, days),
      { skip: query.skip, take: query.limit },
    );
    return this.toPage(page.items, page.total, query);
  }

  async getForRestaurant(
    ownerId: string,
    pensionId: string,
  ): Promise<PensionDetailView> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    const pension = await this.pensions.findForRestaurant(
      pensionId,
      restaurantId,
    );
    if (!pension) {
      throw pensionNotFoundError();
    }
    return this.toDetail(pension);
  }

  private async toDetail(
    pension: PensionWithParties,
  ): Promise<PensionDetailView> {
    const [payments, paidTotal] = await Promise.all([
      this.pensions.listPayments(pension.id),
      this.pensions.sumConfirmedPayments(pension.id),
    ]);
    return {
      ...toPensionView(pension, this.clock.todayUtc()),
      paidTotal,
      payments: payments.map((payment) => toPaymentView(payment)),
    };
  }

  private toPage(
    items: PensionWithParties[],
    total: number,
    query: PageQuery,
  ): Paginated<PensionView> {
    const today = this.clock.todayUtc();
    return paginated(
      items.map((item) => toPensionView(item, today)),
      total,
      query,
    );
  }
}
