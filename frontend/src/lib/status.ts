import type {
  AttendanceStatus,
  InvoiceStatus,
  PaymentStatus,
  PensionStatus,
  ReservationStatus,
  RestaurantStatus,
  UserStatus,
} from '@/lib/api-types';

export type BadgeVariant =
  | 'neutral'
  | 'primary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'secondary';

export interface StatusMeta {
  label: string;
  variant: BadgeVariant;
}

export const PENSION_STATUS: Record<PensionStatus, StatusMeta> = {
  PENDING_PAYMENT: { label: 'Pago pendiente', variant: 'warning' },
  ACTIVE: { label: 'Activa', variant: 'success' },
  EXPIRED: { label: 'Vencida', variant: 'neutral' },
  CANCELLED: { label: 'Cancelada', variant: 'danger' },
  SUSPENDED: { label: 'Suspendida', variant: 'secondary' },
};

export const PAYMENT_STATUS: Record<PaymentStatus, StatusMeta> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  CONFIRMED: { label: 'Confirmado', variant: 'success' },
  VOIDED: { label: 'Anulado', variant: 'danger' },
};

export const RESERVATION_STATUS: Record<ReservationStatus, StatusMeta> = {
  CONFIRMED: { label: 'Confirmada', variant: 'success' },
  CANCELLED: { label: 'Cancelada', variant: 'danger' },
  FULFILLED: { label: 'Cumplida', variant: 'primary' },
  NO_SHOW: { label: 'No asistió', variant: 'neutral' },
};

export const ATTENDANCE_STATUS: Record<AttendanceStatus, StatusMeta> = {
  WILL_ATTEND: { label: 'Asistiré', variant: 'success' },
  WILL_NOT_ATTEND: { label: 'No asistiré', variant: 'neutral' },
  ATTENDED: { label: 'Asistió', variant: 'primary' },
  NO_SHOW: { label: 'No asistió', variant: 'danger' },
};

export const INVOICE_STATUS: Record<InvoiceStatus, StatusMeta> = {
  ISSUED: { label: 'Emitida', variant: 'success' },
  VOIDED: { label: 'Anulada', variant: 'danger' },
};

export const RESTAURANT_STATUS: Record<RestaurantStatus, StatusMeta> = {
  PENDING: { label: 'Pendiente', variant: 'warning' },
  APPROVED: { label: 'Aprobado', variant: 'success' },
  SUSPENDED: { label: 'Suspendido', variant: 'danger' },
};

export const USER_STATUS: Record<UserStatus, StatusMeta> = {
  ACTIVE: { label: 'Activo', variant: 'success' },
  SUSPENDED: { label: 'Suspendido', variant: 'danger' },
};

export const PAYMENT_METHOD_LABEL: Record<string, string> = {
  CASH: 'Efectivo',
  TRANSFER: 'Transferencia',
  CARD: 'Tarjeta',
};
