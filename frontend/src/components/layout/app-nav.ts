import type { LucideIcon } from 'lucide-react';
import {
  CalendarCheck,
  ClipboardCheck,
  LayoutDashboard,
  Megaphone,
  MessageSquare,
  Receipt,
  ScrollText,
  Store,
  UtensilsCrossed,
  Users,
  Utensils,
} from 'lucide-react';
import type { UserRole } from '@/lib/api-types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match the exact path only (index routes), not nested paths. */
  end?: boolean;
}

// Nav grows per milestone as each surface's screens land.
const CLIENT_NAV: NavItem[] = [
  { to: '/app', label: 'Mi pensión', icon: LayoutDashboard, end: true },
  { to: '/app/reservas', label: 'Reservas', icon: CalendarCheck },
  { to: '/app/asistencia', label: 'Asistencia', icon: ClipboardCheck },
  { to: '/app/mensajes', label: 'Mensajes', icon: MessageSquare },
  { to: '/app/facturas', label: 'Facturas', icon: Receipt },
];

const RESTAURANT_NAV: NavItem[] = [
  { to: '/panel', label: 'Resumen', icon: LayoutDashboard, end: true },
  { to: '/panel/pensionarios', label: 'Pensionarios', icon: Users },
  { to: '/panel/menus', label: 'Menús', icon: UtensilsCrossed },
  { to: '/panel/platos', label: 'Platos', icon: Utensils },
  { to: '/panel/reservas', label: 'Reservas', icon: CalendarCheck },
  { to: '/panel/avisos', label: 'Avisos', icon: Megaphone },
  { to: '/panel/mensajes', label: 'Mensajes', icon: MessageSquare },
  { to: '/panel/facturas', label: 'Facturas', icon: Receipt },
  { to: '/panel/restaurante', label: 'Mi restaurante', icon: Store },
];

const ADMIN_NAV: NavItem[] = [
  { to: '/admin', label: 'Restaurantes', icon: Store, end: true },
  { to: '/admin/usuarios', label: 'Usuarios', icon: Users },
  { to: '/admin/auditoria', label: 'Auditoría', icon: ScrollText },
];

/** Sidebar entries for the given role's private area. */
export function navForRole(role: UserRole): NavItem[] {
  switch (role) {
    case 'CLIENT':
      return CLIENT_NAV;
    case 'RESTAURANT_ADMIN':
      return RESTAURANT_NAV;
    case 'SUPER_ADMIN':
      return ADMIN_NAV;
  }
}
