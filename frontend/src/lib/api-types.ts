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
