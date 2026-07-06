/**
 * Pensions domain core. Pure: no Nest, no Prisma (docs/arquitectura.md §4).
 * Status values mirror the DB enum by design; the repository adapter maps.
 */
export const PENSION_DAYS = 30;

export type PensionStatus =
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUSPENDED';

export interface PensionSnapshot {
  id: string;
  clientId: string;
  restaurantId: string;
  startDate: Date;
  endDate: Date;
  price: number;
  status: PensionStatus;
  createdAt: Date;
}
