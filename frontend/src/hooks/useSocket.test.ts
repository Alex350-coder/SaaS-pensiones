import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socket = {
  onAny: vi.fn(),
  offAny: vi.fn(),
  connect: vi.fn(),
  disconnect: vi.fn(),
};
const createNamespaceSocket = vi.fn((_ns: string) => socket);
vi.mock('@/lib/socket', () => ({
  createNamespaceSocket: (ns: string) => createNamespaceSocket(ns),
}));

import { useSocket } from './useSocket';
import { useSessionStore } from '@/stores/session-store';

function authenticate() {
  useSessionStore.setState({
    user: { id: 'u1', email: 'a@b.com', fullName: 'A', role: 'CLIENT' } as never,
    tokens: { accessToken: 'a', refreshToken: 'r' },
  });
}

describe('useSocket', () => {
  beforeEach(() => {
    Object.values(socket).forEach((fn) => fn.mockClear());
    createNamespaceSocket.mockClear();
    useSessionStore.setState({ user: null, tokens: null });
  });
  afterEach(() => useSessionStore.setState({ user: null, tokens: null }));

  it('does not connect while signed out', () => {
    renderHook(() => useSocket('chat', {}));
    expect(createNamespaceSocket).not.toHaveBeenCalled();
  });

  it('connects when authenticated and dispatches events to the latest handler', () => {
    authenticate();
    const onEvent = vi.fn();
    renderHook(() => useSocket('chat', { 'message:new': onEvent }));

    expect(createNamespaceSocket).toHaveBeenCalledWith('chat');
    expect(socket.connect).toHaveBeenCalled();

    // Simulate an inbound event through the registered onAny dispatcher.
    const dispatch = socket.onAny.mock.calls[0][0] as (e: string, p: unknown) => void;
    dispatch('message:new', { id: 'm1' });
    expect(onEvent).toHaveBeenCalledWith({ id: 'm1' });

    // Unknown events are ignored without throwing.
    expect(() => dispatch('unknown:event', {})).not.toThrow();
  });

  it('tears down the socket on unmount', () => {
    authenticate();
    const { unmount } = renderHook(() => useSocket('notifications', {}));
    unmount();
    expect(socket.offAny).toHaveBeenCalled();
    expect(socket.disconnect).toHaveBeenCalled();
  });

  it('stays disconnected when disabled', () => {
    authenticate();
    renderHook(() => useSocket('chat', {}, false));
    expect(createNamespaceSocket).not.toHaveBeenCalled();
  });
});
