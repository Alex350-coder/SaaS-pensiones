import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Paginated, paginated } from '../../../core/http/pagination/paginated';
import { PaginationQueryDto } from '../../../core/http/pagination/pagination-query.dto';
import { PrismaService } from '../../../core/prisma/prisma.service';
import { RestaurantsService } from '../../catalog/application/restaurants.service';
import { renderInvoicePdf } from './invoice-pdf';
import { InvoiceView, toInvoiceView } from './invoice-view';

/** Hydrates an invoice with its series code and the payment's pension parties. */
const INVOICE_INCLUDE = {
  series: { select: { series: true } },
  payment: {
    select: {
      pension: {
        select: {
          id: true,
          restaurant: { select: { id: true, name: true, slug: true } },
          client: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
  },
} satisfies Prisma.InvoiceInclude;

const invoiceNotFoundError = (): NotFoundException =>
  new NotFoundException({
    code: 'INVOICE_NOT_FOUND',
    message: 'La factura no existe.',
  });

/**
 * Read side of the Billing context: invoice history + on-demand PDF, scoped by
 * audience. Every query is filtered by ownership at the DB (restaurant owner
 * via the pension's restaurant; client via the pension's client), so a wrong
 * requester gets the same 404 — existence never leaks across tenants.
 */
@Injectable()
export class InvoicesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly restaurants: RestaurantsService,
  ) {}

  async listForRestaurant(
    ownerId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<InvoiceView>> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    return this.list({ payment: { pension: { restaurantId } } }, query);
  }

  async listForClient(
    clientId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<InvoiceView>> {
    return this.list({ payment: { pension: { clientId } } }, query);
  }

  /** Restaurant owner downloads one of its invoices as PDF (generated now). */
  async pdfForRestaurant(ownerId: string, invoiceId: string): Promise<Buffer> {
    const restaurantId = await this.restaurants.getOwnRestaurantId(ownerId);
    return this.pdf({
      id: invoiceId,
      payment: { pension: { restaurantId } },
    });
  }

  /** Pensioner downloads the PDF of an invoice for one of their payments. */
  async pdfForClient(clientId: string, invoiceId: string): Promise<Buffer> {
    return this.pdf({ id: invoiceId, payment: { pension: { clientId } } });
  }

  private async list(
    where: Prisma.InvoiceWhereInput,
    query: PaginationQueryDto,
  ): Promise<Paginated<InvoiceView>> {
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.invoice.count({ where }),
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: { issuedAt: 'desc' },
        skip: query.skip,
        take: query.limit,
      }),
    ]);
    return paginated(
      rows.map((row) => toInvoiceView(row)),
      total,
      query,
    );
  }

  private async pdf(where: Prisma.InvoiceWhereInput): Promise<Buffer> {
    const row = await this.prisma.invoice.findFirst({
      where,
      include: INVOICE_INCLUDE,
    });
    if (!row) {
      throw invoiceNotFoundError();
    }
    return renderInvoicePdf(toInvoiceView(row));
  }
}
