import { beforeEach, describe, expect, it, vi } from 'vitest';

const ioMock = vi.fn((..._args: unknown[]) => ({ connected: false }));
vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => ioMock(...args) }));

import { createNamespaceSocket } from './socket';
import { useSessionStore } from '@/stores/session-store';

describe('createNamespaceSocket', () => {
  beforeEach(() => {
    ioMock.mockClear();
    useSessionStore.setState({ user: null, tokens: null });
  });

  it('connects to the namespace path, disabled auto-connect', () => {
    createNamespaceSocket('chat');
    const [url, opts] = ioMock.mock.calls[0] as unknown as [
      string,
      { autoConnect: boolean; auth: unknown },
    ];
    expect(url).toBe('/chat');
    expect(opts.autoConnect).toBe(false);
  });

  it('reads the access token freshly via the auth callback', () => {
    useSessionStore.setState({ tokens: { accessToken: 'tok-123', refreshToken: 'r' } });
    createNamespaceSocket('notifications');
    const opts = ioMock.mock.calls[0][1] as { auth: (cb: (p: unknown) => void) => void };
    const cb = vi.fn();
    opts.auth(cb);
    expect(cb).toHaveBeenCalledWith({ token: 'tok-123' });
  });

  it('sends an empty token when signed out', () => {
    createNamespaceSocket('chat');
    const opts = ioMock.mock.calls[0][1] as { auth: (cb: (p: unknown) => void) => void };
    const cb = vi.fn();
    opts.auth(cb);
    expect(cb).toHaveBeenCalledWith({ token: '' });
  });
});
