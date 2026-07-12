/**
 * API-contract tests for every feature's `api.ts`: each thin wrapper must call
 * `apiFetch` with the correct path, method, body and query-string, and pass the
 * result straight through. `apiFetch` is mocked so no network is involved — this
 * pins the REST surface the backend exposes (Phase 14).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(() => Promise.resolve('RESULT')),
}));

import { apiFetch } from '@/lib/api-client';

import * as admin from './admin/api';
import * as attendance from './attendance/api';
import * as auth from './auth/api';
import * as chat from './chat/api';
import * as dashboard from './dashboard/api';
import * as dishes from './dishes/api';
import * as invoices from './invoices/api';
import * as menus from './menus/api';
import * as notices from './notices/api';
import * as notifications from './notifications/api';
import * as ownerMenus from './owner-menus/api';
import * as pensions from './pensions/api';
import * as reservations from './reservations/api';
import * as restaurantPensions from './restaurant-pensions/api';
import * as restaurantProfile from './restaurant-profile/api';
import * as restaurantReservations from './restaurant-reservations/api';
import * as restaurants from './restaurants/api';

const mockFetch = vi.mocked(apiFetch);

/** The path passed to apiFetch for the most recent call. */
function lastPath(): string {
  return mockFetch.mock.calls.at(-1)![0] as string;
}
function lastOpts(): Record<string, unknown> | undefined {
  return mockFetch.mock.calls.at(-1)![1] as Record<string, unknown> | undefined;
}

beforeEach(() => {
  mockFetch.mockClear();
  mockFetch.mockResolvedValue('RESULT');
});

describe('admin api', () => {
  it('lists restaurants with defaults and passes result through', async () => {
    await expect(admin.listAdminRestaurants()).resolves.toBe('RESULT');
    expect(lastPath()).toBe('/admin/restaurants?page=1&limit=30');
  });

  it('appends the status filter when provided', async () => {
    await admin.listAdminRestaurants({ page: 2, limit: 5, status: 'PENDING' });
    expect(lastPath()).toBe('/admin/restaurants?page=2&limit=5&status=PENDING');
  });

  it('changes restaurant status with PATCH', async () => {
    await admin.changeRestaurantStatus('r1', 'APPROVED');
    expect(lastPath()).toBe('/admin/restaurants/r1/status');
    expect(lastOpts()).toEqual({ method: 'PATCH', body: { status: 'APPROVED' } });
  });

  it('lists users with role + status filters', async () => {
    await admin.listAdminUsers({ role: 'CLIENT', status: 'ACTIVE' });
    expect(lastPath()).toBe(
      '/admin/users?page=1&limit=30&role=CLIENT&status=ACTIVE',
    );
  });

  it('lists users with defaults only', async () => {
    await admin.listAdminUsers();
    expect(lastPath()).toBe('/admin/users?page=1&limit=30');
  });

  it('changes user status with PATCH', async () => {
    await admin.changeUserStatus('u1', 'SUSPENDED');
    expect(lastPath()).toBe('/admin/users/u1/status');
    expect(lastOpts()).toEqual({ method: 'PATCH', body: { status: 'SUSPENDED' } });
  });

  it('lists audit events', async () => {
    await admin.listAuditEvents({ page: 3 });
    expect(lastPath()).toBe('/auth/audit-events?page=3&limit=40');
  });
});

describe('attendance api', () => {
  it('confirms attendance with PUT upsert', async () => {
    const input = { pensionId: 'p1', date: '2026-07-11', status: 'WILL_ATTEND' as const };
    await attendance.confirmAttendance(input);
    expect(lastPath()).toBe('/attendance');
    expect(lastOpts()).toEqual({ method: 'PUT', body: input });
  });

  it('lists attendance filtered by pension', async () => {
    await attendance.listMyAttendance({ pensionId: 'p1' });
    expect(lastPath()).toBe('/attendance/mine?page=1&limit=60&pensionId=p1');
  });

  it('lists attendance with defaults', async () => {
    await attendance.listMyAttendance();
    expect(lastPath()).toBe('/attendance/mine?page=1&limit=60');
  });
});

describe('auth api', () => {
  it('fetches the current user', async () => {
    await auth.getMe();
    expect(lastPath()).toBe('/auth/me');
  });

  it('logs in without auth header', async () => {
    await auth.login({ email: 'a@b.com', password: 'pw' });
    expect(lastPath()).toBe('/auth/login');
    expect(lastOpts()).toMatchObject({ method: 'POST', auth: false });
  });

  it('registers, dropping the confirmation field and empty phone', async () => {
    await auth.register({
      fullName: 'Ada',
      email: 'a@b.com',
      password: 'pw',
      confirmPassword: 'pw',
      role: 'CLIENT',
      phone: '',
    } as never);
    expect(lastOpts()!.body).toEqual({
      fullName: 'Ada',
      email: 'a@b.com',
      password: 'pw',
      role: 'CLIENT',
    });
  });

  it('registers including a non-empty phone', async () => {
    await auth.register({
      fullName: 'Ada',
      email: 'a@b.com',
      password: 'pw',
      confirmPassword: 'pw',
      role: 'CLIENT',
      phone: '999',
    } as never);
    expect(lastOpts()!.body).toMatchObject({ phone: '999' });
  });

  it('logs out with the refresh token', async () => {
    await auth.logout('rt');
    expect(lastPath()).toBe('/auth/logout');
    expect(lastOpts()).toEqual({ method: 'POST', body: { refreshToken: 'rt' } });
  });
});

describe('chat api', () => {
  it('opens a conversation', async () => {
    await chat.openConversation('p1');
    expect(lastPath()).toBe('/conversations');
    expect(lastOpts()).toEqual({ method: 'POST', body: { pensionId: 'p1' } });
  });

  it('lists conversations', async () => {
    await chat.listConversations({ page: 2 });
    expect(lastPath()).toBe('/conversations/mine?page=2&limit=20');
  });

  it('gets messages with a cursor', async () => {
    await chat.getMessages('c1', { cursor: 'cur', limit: 10 });
    expect(lastPath()).toBe('/conversations/c1/messages?limit=10&cursor=cur');
  });

  it('gets messages without a cursor', async () => {
    await chat.getMessages('c1');
    expect(lastPath()).toBe('/conversations/c1/messages?limit=30');
  });

  it('sends a message', async () => {
    await chat.sendMessage('c1', 'hola');
    expect(lastPath()).toBe('/conversations/c1/messages');
    expect(lastOpts()).toEqual({ method: 'POST', body: { content: 'hola' } });
  });

  it('marks a conversation read', async () => {
    await chat.markConversationRead('c1');
    expect(lastPath()).toBe('/conversations/c1/read');
    expect(lastOpts()).toEqual({ method: 'POST' });
  });
});

describe('dashboard api', () => {
  it('gets the dashboard metrics', async () => {
    await dashboard.getDashboard();
    expect(lastPath()).toBe('/restaurants/mine/dashboard');
  });
});

describe('dishes api', () => {
  it('lists dishes', async () => {
    await dishes.listDishes();
    expect(lastPath()).toBe('/restaurants/mine/dishes?page=1&limit=100');
  });

  it('creates a dish', async () => {
    const input = { name: 'X', category: 'MAIN' as const, price: 10 };
    await dishes.createDish(input);
    expect(lastPath()).toBe('/restaurants/mine/dishes');
    expect(lastOpts()).toEqual({ method: 'POST', body: input });
  });

  it('updates a dish', async () => {
    await dishes.updateDish('d1', { price: 12 });
    expect(lastPath()).toBe('/restaurants/mine/dishes/d1');
    expect(lastOpts()).toEqual({ method: 'PATCH', body: { price: 12 } });
  });

  it('deletes a dish', async () => {
    await dishes.deleteDish('d1');
    expect(lastPath()).toBe('/restaurants/mine/dishes/d1');
    expect(lastOpts()).toEqual({ method: 'DELETE' });
  });
});

describe('invoices api', () => {
  it('lists client invoices', async () => {
    await invoices.listClientInvoices({ page: 2, limit: 5 });
    expect(lastPath()).toBe('/invoices?page=2&limit=5');
  });

  it('lists restaurant invoices', async () => {
    await invoices.listRestaurantInvoices();
    expect(lastPath()).toBe('/restaurants/mine/invoices?page=1&limit=20');
  });

  it('builds PDF stream paths', () => {
    expect(invoices.clientInvoicePdfPath('i1')).toBe('/invoices/i1/pdf');
    expect(invoices.restaurantInvoicePdfPath('i1')).toBe(
      '/restaurants/mine/invoices/i1/pdf',
    );
  });
});

describe('menus (public) api', () => {
  it('gets today menu without a date, unauthenticated', async () => {
    await menus.getPublicMenu('el-fogon');
    expect(lastPath()).toBe('/restaurants/el-fogon/menu');
    expect(lastOpts()).toEqual({ auth: false });
  });

  it('gets a menu for a specific date', async () => {
    await menus.getPublicMenu('el-fogon', '2026-07-11');
    expect(lastPath()).toBe('/restaurants/el-fogon/menu?date=2026-07-11');
  });
});

describe('notices api', () => {
  it('publishes a notice', async () => {
    const input = { title: 'T', body: 'B', type: 'GENERAL' as const };
    await notices.publishNotice(input);
    expect(lastPath()).toBe('/restaurants/mine/notices');
    expect(lastOpts()).toEqual({ method: 'POST', body: input });
  });

  it('lists owner notices', async () => {
    await notices.listMyNotices();
    expect(lastPath()).toBe('/restaurants/mine/notices?page=1&limit=30');
  });

  it('gets a notice detail', async () => {
    await notices.getNotice('n1');
    expect(lastPath()).toBe('/notices/n1');
  });
});

describe('notifications api', () => {
  it('lists notifications with the unread filter', async () => {
    await notifications.listNotifications({ unread: true });
    expect(lastPath()).toBe('/notifications?page=1&limit=10&unread=true');
  });

  it('lists notifications without the unread filter', async () => {
    await notifications.listNotifications({ page: 2 });
    expect(lastPath()).toBe('/notifications?page=2&limit=10');
  });

  it('gets the unread count', async () => {
    await notifications.getUnreadCount();
    expect(lastPath()).toBe('/notifications/unread-count');
  });

  it('marks one read', async () => {
    await notifications.markNotificationRead('n1');
    expect(lastPath()).toBe('/notifications/n1/read');
    expect(lastOpts()).toEqual({ method: 'POST' });
  });

  it('marks all read', async () => {
    await notifications.markAllNotificationsRead();
    expect(lastPath()).toBe('/notifications/read-all');
  });
});

describe('owner-menus api', () => {
  it('lists menus', async () => {
    await ownerMenus.listMenus();
    expect(lastPath()).toBe('/restaurants/mine/menus?page=1&limit=30');
  });

  it('gets a menu by date', async () => {
    await ownerMenus.getMenu('2026-07-11');
    expect(lastPath()).toBe('/restaurants/mine/menus/2026-07-11');
  });

  it('creates a menu', async () => {
    await ownerMenus.createMenu({ menuDate: '2026-07-11', menuPrice: 15 });
    expect(lastPath()).toBe('/restaurants/mine/menus');
    expect(lastOpts()).toEqual({
      method: 'POST',
      body: { menuDate: '2026-07-11', menuPrice: 15 },
    });
  });

  it('updates the menu price', async () => {
    await ownerMenus.updateMenuPrice('2026-07-11', 20);
    expect(lastOpts()).toEqual({ method: 'PATCH', body: { menuPrice: 20 } });
  });

  it('replaces menu items', async () => {
    const items = [{ dishId: 'd1', course: 'MAIN' as const }];
    await ownerMenus.replaceMenuItems('2026-07-11', items);
    expect(lastPath()).toBe('/restaurants/mine/menus/2026-07-11/items');
    expect(lastOpts()).toEqual({ method: 'PUT', body: { items } });
  });

  it('changes the menu status', async () => {
    await ownerMenus.changeMenuStatus('2026-07-11', 'PUBLISHED');
    expect(lastPath()).toBe('/restaurants/mine/menus/2026-07-11/status');
    expect(lastOpts()).toEqual({ method: 'PATCH', body: { status: 'PUBLISHED' } });
  });

  it('deletes a menu', async () => {
    await ownerMenus.deleteMenu('2026-07-11');
    expect(lastOpts()).toEqual({ method: 'DELETE' });
  });
});

describe('pensions api', () => {
  it('contracts a pension', async () => {
    await pensions.contractPension('r1');
    expect(lastPath()).toBe('/pensions');
    expect(lastOpts()).toEqual({ method: 'POST', body: { restaurantId: 'r1' } });
  });

  it('lists my pensions with a status filter', async () => {
    await pensions.listMyPensions({ status: 'ACTIVE' });
    expect(lastPath()).toBe('/pensions/mine?page=1&limit=20&status=ACTIVE');
  });

  it('lists my pensions without a filter', async () => {
    await pensions.listMyPensions();
    expect(lastPath()).toBe('/pensions/mine?page=1&limit=20');
  });

  it('gets one pension', async () => {
    await pensions.getMyPension('p1');
    expect(lastPath()).toBe('/pensions/mine/p1');
  });

  it('cancels a pension', async () => {
    await pensions.cancelPension('p1');
    expect(lastPath()).toBe('/pensions/mine/p1/cancel');
    expect(lastOpts()).toEqual({ method: 'POST' });
  });
});

describe('reservations api', () => {
  it('creates a reservation', async () => {
    const input = { dailyMenuId: 'm1', estimatedArrival: '12:30' };
    await reservations.createReservation(input);
    expect(lastPath()).toBe('/reservations');
    expect(lastOpts()).toEqual({ method: 'POST', body: input });
  });

  it('lists my reservations with a status filter', async () => {
    await reservations.listMyReservations({ status: 'CONFIRMED' });
    expect(lastPath()).toBe('/reservations/mine?page=1&limit=20&status=CONFIRMED');
  });

  it('lists my reservations without a filter', async () => {
    await reservations.listMyReservations();
    expect(lastPath()).toBe('/reservations/mine?page=1&limit=20');
  });

  it('updates a reservation', async () => {
    await reservations.updateReservation('r1', { notes: 'sin ají' });
    expect(lastPath()).toBe('/reservations/mine/r1');
    expect(lastOpts()).toEqual({ method: 'PATCH', body: { notes: 'sin ají' } });
  });

  it('cancels a reservation', async () => {
    await reservations.cancelReservation('r1');
    expect(lastPath()).toBe('/reservations/mine/r1/cancel');
  });
});

describe('restaurant-pensions api', () => {
  it('lists pensions with a status filter', async () => {
    await restaurantPensions.listRestaurantPensions({ status: 'ACTIVE' });
    expect(lastPath()).toBe(
      '/restaurants/mine/pensions?page=1&limit=30&status=ACTIVE',
    );
  });

  it('lists pensions without a filter', async () => {
    await restaurantPensions.listRestaurantPensions();
    expect(lastPath()).toBe('/restaurants/mine/pensions?page=1&limit=30');
  });

  it('lists expiring pensions with a custom window', async () => {
    await restaurantPensions.listExpiringPensions(7);
    expect(lastPath()).toBe('/restaurants/mine/pensions/expiring?days=7');
  });

  it('lists expiring pensions with the default window', async () => {
    await restaurantPensions.listExpiringPensions();
    expect(lastPath()).toBe('/restaurants/mine/pensions/expiring?days=3');
  });

  it('gets one pension', async () => {
    await restaurantPensions.getRestaurantPension('p1');
    expect(lastPath()).toBe('/restaurants/mine/pensions/p1');
  });

  it('registers a payment', async () => {
    const input = { amount: 100, method: 'CASH' as const };
    await restaurantPensions.registerPayment('p1', input);
    expect(lastPath()).toBe('/restaurants/mine/pensions/p1/payments');
    expect(lastOpts()).toEqual({ method: 'POST', body: input });
  });

  it('changes pension status', async () => {
    await restaurantPensions.changePensionStatus('p1', 'SUSPENDED');
    expect(lastPath()).toBe('/restaurants/mine/pensions/p1/status');
    expect(lastOpts()).toEqual({ method: 'PATCH', body: { status: 'SUSPENDED' } });
  });
});

describe('restaurant-profile api', () => {
  const profile = {
    name: 'N',
    description: 'D',
    address: 'A',
    contactPhone: '1',
    contactEmail: 'e@x.com',
    monthlyPensionPrice: 300,
  };

  it('gets the own restaurant', async () => {
    await restaurantProfile.getOwnRestaurant();
    expect(lastPath()).toBe('/restaurants/mine');
  });

  it('creates the own restaurant', async () => {
    await restaurantProfile.createOwnRestaurant(profile);
    expect(lastOpts()).toEqual({ method: 'POST', body: profile });
  });

  it('updates the own restaurant', async () => {
    await restaurantProfile.updateOwnRestaurant({ name: 'N2' });
    expect(lastOpts()).toEqual({ method: 'PATCH', body: { name: 'N2' } });
  });

  it('replaces schedules', async () => {
    const schedules = [
      { dayOfWeek: 1, opensAt: '08:00', closesAt: '20:00', isClosed: false },
    ];
    await restaurantProfile.replaceSchedules(schedules as never);
    expect(lastPath()).toBe('/restaurants/mine/schedules');
    expect(lastOpts()).toEqual({ method: 'PUT', body: { schedules } });
  });

  it('adds an image', async () => {
    await restaurantProfile.addImage('http://img');
    expect(lastOpts()).toEqual({ method: 'POST', body: { url: 'http://img' } });
  });

  it('removes an image', async () => {
    await restaurantProfile.removeImage('img1');
    expect(lastPath()).toBe('/restaurants/mine/images/img1');
    expect(lastOpts()).toEqual({ method: 'DELETE' });
  });
});

describe('restaurant-reservations api', () => {
  it('lists day reservations with a date', async () => {
    await restaurantReservations.listDayReservations({ date: '2026-07-11' });
    expect(lastPath()).toBe(
      '/restaurants/mine/reservations?page=1&limit=100&date=2026-07-11',
    );
  });

  it('lists day reservations without a date', async () => {
    await restaurantReservations.listDayReservations();
    expect(lastPath()).toBe('/restaurants/mine/reservations?page=1&limit=100');
  });

  it('gets the projection for a date', async () => {
    await restaurantReservations.getProjection('2026-07-11');
    expect(lastPath()).toBe(
      '/restaurants/mine/production-projection?date=2026-07-11',
    );
  });

  it('gets the projection for today', async () => {
    await restaurantReservations.getProjection();
    expect(lastPath()).toBe('/restaurants/mine/production-projection');
  });
});

describe('restaurants (public) api', () => {
  it('lists restaurants unauthenticated', async () => {
    await restaurants.listRestaurants({ page: 2, limit: 6 });
    expect(lastPath()).toBe('/restaurants?page=2&limit=6');
    expect(lastOpts()).toEqual({ auth: false });
  });

  it('lists restaurants with defaults', async () => {
    await restaurants.listRestaurants();
    expect(lastPath()).toBe('/restaurants?page=1&limit=12');
  });

  it('gets a restaurant by slug unauthenticated', async () => {
    await restaurants.getRestaurant('el-fogon');
    expect(lastPath()).toBe('/restaurants/el-fogon');
    expect(lastOpts()).toEqual({ auth: false });
  });
});
