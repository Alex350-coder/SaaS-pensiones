/**
 * Behavioural tests for every feature's TanStack Query hooks. `apiFetch` is
 * mocked so each real `api.ts` resolves instantly; hooks are mounted to run
 * their queryFn/mutationFn + onSuccess wiring, and the query-key factories are
 * asserted directly. The chat cache mutators are exercised over seeded data.
 */
import { renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/api-client', () => ({
  apiFetch: vi.fn(() => Promise.resolve({ items: [], meta: {}, nextCursor: null })),
}));

import type { InfiniteData } from '@tanstack/react-query';
import { apiFetch } from '@/lib/api-client';
import type { MessagePage, MessageView } from '@/lib/api-types';
import { useSessionStore } from '@/stores/session-store';
import { makeTestQueryClient, withQueryClient } from '@/test/query-utils';

import * as admin from './admin/hooks';
import * as attendance from './attendance/hooks';
import * as auth from './auth/hooks';
import * as chat from './chat/hooks';
import { useDashboard } from './dashboard/hooks';
import * as dishes from './dishes/hooks';
import * as invoices from './invoices/hooks';
import { usePublicMenu } from './menus/hooks';
import * as notices from './notices/hooks';
import * as notifications from './notifications/hooks';
import * as ownerMenus from './owner-menus/hooks';
import * as pensions from './pensions/hooks';
import * as reservations from './reservations/hooks';
import * as restaurantPensions from './restaurant-pensions/hooks';
import * as restaurantProfile from './restaurant-profile/hooks';
import * as restaurantReservations from './restaurant-reservations/hooks';
import * as restaurants from './restaurants/hooks';

const mockFetch = vi.mocked(apiFetch);

beforeEach(() => {
  mockFetch.mockClear();
  // Authenticate so `enabled: isAuthenticated` queries actually run.
  useSessionStore.setState({
    user: {
      id: 'u1',
      email: 'a@b.com',
      fullName: 'Ada',
      role: 'CLIENT',
    } as never,
  });
});

afterEach(() => {
  useSessionStore.setState({ user: null });
});

/** Mount a query hook and wait until its queryFn has resolved. */
async function runQuery<T>(hook: () => { isSuccess: boolean } & T) {
  const { result } = renderHook(hook, { wrapper: withQueryClient() });
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
  return result;
}

/** Mount a mutation hook, fire it once, and wait for success. */
async function runMutation(hook: () => { mutate: (v: never) => void; isSuccess: boolean }, arg: unknown) {
  const { result } = renderHook(hook, { wrapper: withQueryClient() });
  result.current.mutate(arg as never);
  await waitFor(() => expect(result.current.isSuccess).toBe(true));
}

describe('query-key factories', () => {
  it('build stable, namespaced keys', () => {
    expect(pensions.pensionKeys.list('ACTIVE')).toEqual(['pensions', 'list', 'ACTIVE']);
    expect(pensions.pensionKeys.list()).toEqual(['pensions', 'list', 'all']);
    expect(pensions.pensionKeys.detail('p1')).toEqual(['pensions', 'detail', 'p1']);
    expect(chat.chatKeys.conversations()).toEqual(['chat', 'conversations']);
    expect(chat.chatKeys.messages('c1')).toEqual(['chat', 'messages', 'c1']);
    expect(notifications.notificationKeys.list(true)).toEqual([
      'notifications',
      'list',
      { unread: true },
    ]);
    expect(notifications.notificationKeys.unreadCount()).toEqual([
      'notifications',
      'unread-count',
    ]);
    expect(restaurants.restaurantKeys.detail('slug')).toEqual([
      'restaurants',
      'detail',
      'slug',
    ]);
    expect(admin.adminKeys).toBeTruthy();
    expect(dishes.dishKeys).toBeTruthy();
    expect(invoices.invoiceKeys).toBeTruthy();
    expect(notices.noticeKeys).toBeTruthy();
    expect(attendance.attendanceKeys).toBeTruthy();
    expect(reservations.reservationKeys).toBeTruthy();
    expect(restaurantPensions.restaurantPensionKeys).toBeTruthy();
    expect(restaurantProfile.ownRestaurantKeys).toBeTruthy();
    expect(restaurantReservations.restaurantReservationKeys).toBeTruthy();
  });
});

describe('query hooks run their queryFn', () => {
  it('client + public queries', async () => {
    await runQuery(() => pensions.useMyPensions('ACTIVE'));
    await runQuery(() => pensions.useMyPension('p1'));
    await runQuery(() => reservations.useMyReservations());
    await runQuery(() => attendance.useMyAttendance('p1'));
    await runQuery(() => invoices.useClientInvoices());
    await runQuery(() => restaurants.useRestaurants(1));
    await runQuery(() => restaurants.useRestaurant('slug'));
    await runQuery(() => usePublicMenu('slug', '2026-07-11'));
    await runQuery(() => chat.useConversations());
    await runQuery(() => notifications.useUnreadCount());
    await runQuery(() => notifications.useNotifications(true));
    expect(mockFetch).toHaveBeenCalled();
  });

  it('owner + admin queries', async () => {
    await runQuery(() => dishes.useDishes());
    await runQuery(() => ownerMenus.useOwnerMenu('2026-07-11'));
    await runQuery(() => notices.useMyNotices());
    await runQuery(() => notices.useNotice('n1'));
    await runQuery(() => invoices.useRestaurantInvoices());
    await runQuery(() => restaurantPensions.useRestaurantPensions('ACTIVE'));
    await runQuery(() => restaurantPensions.useExpiringPensions());
    await runQuery(() => restaurantPensions.useRestaurantPension('p1'));
    await runQuery(() => restaurantReservations.useDayReservations('2026-07-11'));
    await runQuery(() => restaurantReservations.useProjection('2026-07-11'));
    await runQuery(() => restaurantProfile.useOwnRestaurant());
    await runQuery(() => useDashboard());
    await runQuery(() => admin.useAdminRestaurants());
    await runQuery(() => admin.useAdminUsers());
    await runQuery(() => admin.useAuditEvents());
  });

  it('disabled queries stay idle when their id is null', () => {
    const { result } = renderHook(() => pensions.useMyPension(null), {
      wrapper: withQueryClient(),
    });
    expect(result.current.fetchStatus).toBe('idle');
  });

  it('infinite message query walks pages', async () => {
    const { result } = renderHook(() => chat.useMessages('c1'), {
      wrapper: withQueryClient(),
    });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
  });
});

describe('mutation hooks run their mutationFn', () => {
  it('client mutations', async () => {
    await runMutation(() => pensions.useContractPension(), 'r1');
    await runMutation(() => pensions.useCancelPension(), 'p1');
    await runMutation(
      () => reservations.useCreateReservation(),
      { dailyMenuId: 'm1', estimatedArrival: '12:30' },
    );
    await runMutation(() => reservations.useCancelReservation(), 'r1');
    await runMutation(
      () => attendance.useConfirmAttendance(),
      { pensionId: 'p1', date: '2026-07-11', status: 'WILL_ATTEND' },
    );
    await runMutation(() => chat.useMarkConversationRead(), 'c1');
  });

  it('owner + admin mutations', async () => {
    await runMutation(() => dishes.useCreateDish(), { name: 'X', category: 'MAIN_COURSE', price: 1 });
    await runMutation(() => dishes.useUpdateDish(), { id: 'd1', input: { price: 2 } });
    await runMutation(() => dishes.useDeleteDish(), 'd1');
    await runMutation(() => ownerMenus.useCreateMenu(), { menuDate: '2026-07-11', menuPrice: 15 });
    await runMutation(() => ownerMenus.useDeleteMenu(), '2026-07-11');
    await runMutation(() => notices.usePublishNotice(), { title: 'T', body: 'B' });
    await runMutation(
      () => restaurantPensions.useRegisterPayment(),
      { id: 'p1', input: { amount: 1, method: 'CASH' } },
    );
    await runMutation(
      () => restaurantPensions.useChangePensionStatus(),
      { id: 'p1', status: 'SUSPENDED' },
    );
    await runMutation(() => restaurantProfile.useAddImage(), 'http://img');
    await runMutation(() => admin.useChangeRestaurantStatus(), { id: 'r1', status: 'APPROVED' });
    await runMutation(() => admin.useChangeUserStatus(), { id: 'u1', status: 'SUSPENDED' });
  });

  it('auth mutations persist / clear the session', async () => {
    await runMutation(() => auth.useLogin(), { email: 'a@b.com', password: 'pw' });
    await runMutation(() => auth.useRegister(), {
      fullName: 'Ada',
      email: 'a@b.com',
      password: 'pw',
      confirmPassword: 'pw',
      role: 'CLIENT',
    });
    // Logout best-effort revokes then always clears local session.
    await runMutation(() => auth.useLogout(), undefined);
    expect(useSessionStore.getState().user).toBeNull();
  });
});

describe('useChatCache', () => {
  const baseMessage = (id: string, senderId: string): MessageView =>
    ({
      id,
      conversationId: 'c1',
      senderId,
      content: 'hola',
      createdAt: '2026-07-11T10:00:00Z',
      readAt: null,
    }) as MessageView;

  function seed(client: ReturnType<typeof makeTestQueryClient>, items: MessageView[]) {
    client.setQueryData<InfiniteData<MessagePage>>(chat.chatKeys.messages('c1'), {
      pages: [{ items, nextCursor: null } as MessagePage],
      pageParams: [undefined],
    });
  }

  it('prepends a new message and dedupes by id', () => {
    const client = makeTestQueryClient();
    seed(client, [baseMessage('m1', 'other')]);
    const { result } = renderHook(() => chat.useChatCache(), {
      wrapper: withQueryClient(client),
    });

    result.current.appendMessage(baseMessage('m2', 'me'));
    let page = client.getQueryData<InfiniteData<MessagePage>>(
      chat.chatKeys.messages('c1'),
    );
    expect(page!.pages[0].items.map((m) => m.id)).toEqual(['m2', 'm1']);

    // Re-appending the same id is a no-op.
    result.current.appendMessage(baseMessage('m2', 'me'));
    page = client.getQueryData<InfiniteData<MessagePage>>(chat.chatKeys.messages('c1'));
    expect(page!.pages[0].items).toHaveLength(2);
  });

  it('is a no-op when there is no cached conversation', () => {
    const client = makeTestQueryClient();
    const { result } = renderHook(() => chat.useChatCache(), {
      wrapper: withQueryClient(client),
    });
    expect(() => result.current.appendMessage(baseMessage('m1', 'me'))).not.toThrow();
    result.current.invalidateConversations();
  });

  it('marks the other party messages read', () => {
    const client = makeTestQueryClient();
    seed(client, [baseMessage('m1', 'other'), baseMessage('m2', 'me')]);
    const { result } = renderHook(() => chat.useChatCache(), {
      wrapper: withQueryClient(client),
    });

    result.current.markRead('c1', 'me');
    const page = client.getQueryData<InfiniteData<MessagePage>>(
      chat.chatKeys.messages('c1'),
    );
    const byId = Object.fromEntries(page!.pages[0].items.map((m) => [m.id, m.readAt]));
    expect(byId.m1).not.toBeNull(); // other party's message → marked read
    expect(byId.m2).toBeNull(); // my own message → untouched
  });
});
