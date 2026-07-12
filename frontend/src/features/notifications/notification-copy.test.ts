import { describe, expect, test } from 'vitest';
import type { NotificationView } from '@/lib/api-types';
import {
  notificationConversationId,
  notificationCopy,
  notificationNoticeId,
} from './notification-copy';

function make(
  type: NotificationView['type'],
  payload: Record<string, unknown> = {},
): NotificationView {
  return {
    id: 'n1',
    userId: 'u1',
    type,
    payload,
    readAt: null,
    createdAt: '2026-07-11T10:00:00.000Z',
  };
}

describe('notificationCopy', () => {
  test('uses the notice title from the payload when present', () => {
    expect(notificationCopy(make('NOTICE', { title: 'Cierre hoy' })).title).toBe(
      'Cierre hoy',
    );
  });

  test('falls back to a generic title for a bare NOTICE payload', () => {
    expect(notificationCopy(make('NOTICE')).title).toBe('Nuevo aviso');
  });

  test('maps known types to fixed copy', () => {
    expect(notificationCopy(make('NEW_MESSAGE')).title).toBe('Nuevo mensaje');
    expect(notificationCopy(make('PENSION_EXPIRING')).title).toContain('vence');
  });
});

describe('deep-link extractors', () => {
  test('reads the conversation id only from NEW_MESSAGE', () => {
    expect(
      notificationConversationId(make('NEW_MESSAGE', { conversationId: 'c1' })),
    ).toBe('c1');
    expect(notificationConversationId(make('NOTICE', { conversationId: 'c1' }))).toBeUndefined();
  });

  test('reads the notice id only from NOTICE', () => {
    expect(notificationNoticeId(make('NOTICE', { noticeId: 'x1' }))).toBe('x1');
    expect(notificationNoticeId(make('NEW_MESSAGE', { noticeId: 'x1' }))).toBeUndefined();
  });
});
