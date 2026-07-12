import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/** A controllable in-memory Socket.IO double. */
function makeFakeSocket() {
  const listeners: Record<string, Array<(p: unknown) => void>> = {};
  return {
    connected: false,
    on: vi.fn((ev: string, cb: (p: unknown) => void) => {
      (listeners[ev] ??= []).push(cb);
    }),
    off: vi.fn((ev: string, cb?: (p: unknown) => void) => {
      if (cb) listeners[ev] = (listeners[ev] ?? []).filter((h) => h !== cb);
      else delete listeners[ev];
    }),
    emit: vi.fn(function (this: { connected: boolean }, _ev: string, _payload: unknown, ack?: (a: unknown) => void) {
      if (ack) ack({ success: true, data: { id: 'm1' }, error: null });
    }),
    connect: vi.fn(function (this: { connected: boolean }) {
      this.connected = true;
    }),
    disconnect: vi.fn(function (this: { connected: boolean }) {
      this.connected = false;
    }),
    fire: (ev: string, payload: unknown) =>
      (listeners[ev] ?? []).forEach((h) => h(payload)),
  };
}

let fakeSocket = makeFakeSocket();
const createNamespaceSocket = vi.fn(() => fakeSocket as never);
vi.mock('@/lib/socket', () => ({
  createNamespaceSocket: () => createNamespaceSocket(),
}));

import { useChatSocket } from './useChatSocket';
import { useSessionStore } from '@/stores/session-store';

function authenticate() {
  useSessionStore.setState({
    user: { id: 'u1', email: 'a@b.com', fullName: 'A', role: 'CLIENT' } as never,
    tokens: { accessToken: 'a', refreshToken: 'r' },
  });
}

const handlers = () => ({ onMessage: vi.fn(), onRead: vi.fn() });

describe('useChatSocket', () => {
  beforeEach(() => {
    fakeSocket = makeFakeSocket();
    createNamespaceSocket.mockClear();
    authenticate();
  });
  afterEach(() => useSessionStore.setState({ user: null, tokens: null }));

  it('connects and joins the active conversation room', () => {
    renderHook(() => useChatSocket('c1', handlers()));
    expect(createNamespaceSocket).toHaveBeenCalled();
    expect(fakeSocket.connect).toHaveBeenCalled();
    expect(fakeSocket.emit).toHaveBeenCalledWith('conversation:join', {
      conversationId: 'c1',
    });
  });

  it('routes inbound message + read events to the latest handlers', () => {
    const h = handlers();
    renderHook(() => useChatSocket('c1', h));
    act(() => fakeSocket.fire('message:new', { id: 'm9' }));
    act(() => fakeSocket.fire('message:read', { conversationId: 'c1', readerId: 'u2', updated: 1 }));
    expect(h.onMessage).toHaveBeenCalledWith({ id: 'm9' });
    expect(h.onRead).toHaveBeenCalledWith({ conversationId: 'c1', readerId: 'u2', updated: 1 });
  });

  it('re-joins the room after a reconnect', () => {
    renderHook(() => useChatSocket('c1', handlers()));
    fakeSocket.emit.mockClear();
    act(() => fakeSocket.fire('connect', undefined));
    expect(fakeSocket.emit).toHaveBeenCalledWith('conversation:join', {
      conversationId: 'c1',
    });
  });

  it('send() emits with an ack and resolves the envelope', async () => {
    const { result } = renderHook(() => useChatSocket('c1', handlers()));
    const ack = await result.current.send('hola');
    expect(fakeSocket.emit).toHaveBeenCalledWith(
      'message:send',
      { conversationId: 'c1', content: 'hola' },
      expect.any(Function),
    );
    expect(ack).toEqual({ success: true, data: { id: 'm1' }, error: null });
  });

  it('send() fails fast with NO_SOCKET when there is no active conversation', async () => {
    const { result } = renderHook(() => useChatSocket(null, handlers()));
    const ack = await result.current.send('hola');
    expect(ack.error?.code).toBe('NO_SOCKET');
  });

  it('markRead emits conversation:read while connected', () => {
    const { result } = renderHook(() => useChatSocket('c1', handlers()));
    fakeSocket.emit.mockClear();
    act(() => result.current.markRead());
    expect(fakeSocket.emit).toHaveBeenCalledWith('conversation:read', {
      conversationId: 'c1',
    });
  });

  it('leaves the previous room and joins the new one when switching conversations', () => {
    const { rerender } = renderHook(({ id }) => useChatSocket(id, handlers()), {
      initialProps: { id: 'c1' as string | null },
    });
    fakeSocket.emit.mockClear();
    rerender({ id: 'c2' });
    expect(fakeSocket.emit).toHaveBeenCalledWith('conversation:leave', {
      conversationId: 'c1',
    });
    expect(fakeSocket.emit).toHaveBeenCalledWith('conversation:join', {
      conversationId: 'c2',
    });
  });

  it('tears down socket listeners and disconnects on unmount', () => {
    const { unmount } = renderHook(() => useChatSocket('c1', handlers()));
    unmount();
    expect(fakeSocket.disconnect).toHaveBeenCalled();
    expect(fakeSocket.off).toHaveBeenCalledWith('message:new');
    expect(fakeSocket.off).toHaveBeenCalledWith('message:read');
  });

  it('does nothing without an authenticated session', () => {
    useSessionStore.setState({ user: null, tokens: null });
    const { result } = renderHook(() => useChatSocket('c1', handlers()));
    expect(createNamespaceSocket).not.toHaveBeenCalled();
    return expect(result.current.send('x')).resolves.toMatchObject({
      error: { code: 'NO_SOCKET' },
    });
  });
});
