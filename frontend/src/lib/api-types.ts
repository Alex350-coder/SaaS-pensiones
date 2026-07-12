/**
 * Shared API contract types — mirror the backend response shapes so features
 * consume one source of truth (DRY). Kept in sync with:
 *   - identity/application/auth.service.ts (AuthSession, PublicUser)
 *   - catalog/application/restaurants.service.ts (public views)
 *   - menu/application/daily-menus.service.ts (public menu)
 */

export type UserRole = 'CLIENT' | 'RESTAURANT_ADMIN' | 'SUPER_ADMIN';

export type DishCategory = 'STARTER' | 'MAIN' | 'BEVERAGE' | 'DESSERT';

// --- Identity ---------------------------------------------------------------

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface AuthSession extends TokenPair {
  user: SessionUser;
}

/** `GET /auth/me` — the session user plus the optional phone on record. */
export interface MeUser extends SessionUser {
  phone: string | null;
}

// --- Catalog ----------------------------------------------------------------

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

export interface PublicRestaurantDetail extends PublicRestaurantListItem {
  contactPhone: string;
  contactEmail: string;
  latitude: number | null;
  longitude: number | null;
  images: ImageView[];
  schedules: ScheduleView[];
}

// --- Menu -------------------------------------------------------------------

export interface MenuItemView {
  id: string;
  course: DishCategory;
  dish: {
    id: string;
    name: string;
    description: string | null;
    category: DishCategory;
    price: number;
    imageUrl: string | null;
  };
}

export interface PublicMenu {
  id: string;
  menuDate: string;
  menuPrice: number;
  items: MenuItemView[];
}

// --- Shared enums -----------------------------------------------------------

export type PensionStatus =
  | 'PENDING_PAYMENT'
  | 'ACTIVE'
  | 'EXPIRED'
  | 'CANCELLED'
  | 'SUSPENDED';

export type PaymentMethod = 'CASH' | 'TRANSFER' | 'CARD';
export type PaymentStatus = 'PENDING' | 'CONFIRMED' | 'VOIDED';
export type ReservationStatus =
  | 'CONFIRMED'
  | 'CANCELLED'
  | 'FULFILLED'
  | 'NO_SHOW';
export type AttendanceStatus =
  | 'WILL_ATTEND'
  | 'WILL_NOT_ATTEND'
  | 'ATTENDED'
  | 'NO_SHOW';
export type InvoiceStatus = 'ISSUED' | 'VOIDED';
export type RestaurantStatus = 'PENDING' | 'APPROVED' | 'SUSPENDED';
export type UserStatus = 'ACTIVE' | 'SUSPENDED';
export type MenuStatus = 'DRAFT' | 'PUBLISHED';

// --- Pensions ---------------------------------------------------------------

export interface PensionView {
  id: string;
  status: PensionStatus;
  startDate: string;
  endDate: string;
  price: number;
  daysRemaining: number;
  client: { id: string; fullName: string; email: string };
  restaurant: { id: string; name: string; slug: string };
  createdAt: string;
}

export interface PaymentView {
  id: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paidAt: string | null;
}

export interface PensionDetailView extends PensionView {
  paidTotal: number;
  payments: PaymentView[];
}

// --- Reservations & Attendance ----------------------------------------------

export interface ClientReservationView {
  id: string;
  status: ReservationStatus;
  menuDate: string;
  estimatedArrival: string;
  notes: string | null;
  pensionId: string | null;
  restaurant: { id: string; name: string; slug: string };
  createdAt: string;
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

export interface AttendanceView {
  id: string;
  pensionId: string;
  restaurantId: string;
  date: string;
  status: AttendanceStatus;
  confirmedAt: string;
}

// --- Restaurant dashboard & management --------------------------------------

export interface DashboardMetrics {
  date: string;
  activePensioners: number;
  pendingPayments: { count: number; amount: number };
  todayReservations: number;
  projectedAttendance: number;
  estimatedRevenue: number;
}

export interface DishView {
  id: string;
  name: string;
  description: string | null;
  category: DishCategory;
  price: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface OwnerMenuView {
  id: string;
  menuDate: string;
  status: MenuStatus;
  menuPrice: number;
  items: MenuItemView[];
}

export interface ProductionProjectionView {
  date: string;
  reservations: { confirmed: number };
  attendance: { willAttend: number; willNotAttend: number };
  pensioners: { active: number; unanswered: number };
  projectedAttendance: number;
}

/** Owner's own restaurant: the public detail plus status + creation date. */
export interface OwnerRestaurantView extends PublicRestaurantDetail {
  status: RestaurantStatus;
  createdAt: string;
}

// --- Platform admin (Super Admin) -------------------------------------------

export interface AdminRestaurantView extends PublicRestaurantListItem {
  status: RestaurantStatus;
  contactPhone: string;
  contactEmail: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export interface AdminUserView {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
}

export interface AuditEventView {
  id: string;
  action: string;
  createdAt: string;
  actorId?: string | null;
  entityType?: string | null;
  entityId?: string | null;
  metadata?: unknown;
}

// --- Billing ----------------------------------------------------------------

export interface InvoiceView {
  id: string;
  series: string;
  number: number;
  serial: string;
  status: InvoiceStatus;
  total: number;
  issuedAt: string;
  pensionId: string;
  restaurant: { id: string; name: string; slug: string };
  client: { id: string; fullName: string; email: string };
}

// --- Communication: notifications, chat, notices ----------------------------

export type NotificationType =
  | 'NOTICE'
  | 'PENSION_EXPIRING'
  | 'PAYMENT_DUE'
  | 'NEW_MESSAGE'
  | 'RESERVATION'
  | 'SYSTEM';

/** Bell row. `payload` is a JSON object whose keys depend on `type`. Dates are
 *  ISO strings over the wire (the backend `Date` fields serialize to strings). */
export interface NotificationView {
  id: string;
  userId: string;
  type: NotificationType;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
}

export type NoticeType =
  | 'MENU_CHANGE'
  | 'SCHEDULE_CHANGE'
  | 'PROMOTION'
  | 'CLOSURE'
  | 'GENERAL';

export interface NoticeView {
  id: string;
  restaurantId: string;
  title: string;
  body: string;
  type: NoticeType;
  publishedAt: string;
}

export interface OwnerNoticeView extends NoticeView {
  readCount: number;
}

export interface ClientNoticeView extends NoticeView {
  restaurant: { id: string; name: string; slug: string };
}

export interface ConversationView {
  id: string;
  pensionId: string;
  pensionStatus: PensionStatus;
  writable: boolean;
  restaurant: { id: string; name: string; slug: string };
  client: { id: string; fullName: string };
  lastMessage: {
    id: string;
    senderId: string;
    content: string;
    createdAt: string;
  } | null;
  unreadCount: number;
}

export interface MessageView {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  readAt: string | null;
  createdAt: string;
}

/** Keyset page of chat history (newest first); `nextCursor` walks older. */
export interface MessagePage {
  items: MessageView[];
  nextCursor: string | null;
}
