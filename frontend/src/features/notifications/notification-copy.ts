import type { LucideIcon } from 'lucide-react';
import {
  Bell,
  CalendarClock,
  CreditCard,
  Megaphone,
  MessageSquare,
  UtensilsCrossed,
} from 'lucide-react';
import type { NotificationView } from '@/lib/api-types';

interface NotificationCopy {
  icon: LucideIcon;
  title: string;
  description?: string;
}

function readString(
  payload: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = payload[key];
  return typeof value === 'string' ? value : undefined;
}

/** Human-facing icon + text for a bell row, derived from its typed payload. */
export function notificationCopy(n: NotificationView): NotificationCopy {
  switch (n.type) {
    case 'NOTICE':
      return {
        icon: Megaphone,
        title: readString(n.payload, 'title') ?? 'Nuevo aviso',
        description: 'Aviso del restaurante',
      };
    case 'NEW_MESSAGE':
      return {
        icon: MessageSquare,
        title: 'Nuevo mensaje',
        description: 'Tienes un mensaje sin leer',
      };
    case 'PENSION_EXPIRING':
      return {
        icon: CalendarClock,
        title: 'Tu pensión vence pronto',
        description: 'Renueva para no perder tu plan',
      };
    case 'PAYMENT_DUE':
      return {
        icon: CreditCard,
        title: 'Pago pendiente',
        description: 'Tienes un pago por regularizar',
      };
    case 'RESERVATION':
      return { icon: UtensilsCrossed, title: 'Actualización de reserva' };
    case 'SYSTEM':
    default:
      return { icon: Bell, title: 'Notificación' };
  }
}

/** Notice id a NOTICE row points to, for opening the aviso. */
export function notificationNoticeId(n: NotificationView): string | undefined {
  return n.type === 'NOTICE' ? readString(n.payload, 'noticeId') : undefined;
}

/** Conversation id a NEW_MESSAGE row points to, for deep-linking to chat. */
export function notificationConversationId(
  n: NotificationView,
): string | undefined {
  return n.type === 'NEW_MESSAGE'
    ? readString(n.payload, 'conversationId')
    : undefined;
}
