import { beforeEach, describe, expect, it, vi } from 'vitest';

const ioMock = vi.fn((..._args: unknown[]) => ({ connected: false }));
vi.mock('socket.io-client', () => ({ io: (...args: unknown[]) => ioMock(...args) }));

import { createNamespaceSocket } from './socket';

describe('createNamespaceSocket', () => {
  beforeEach(() => ioMock.mockClear());

  it('connects to the namespace path with auto-connect disabled', () => {
    createNamespaceSocket('chat');
    const [url, opts] = ioMock.mock.calls[0] as unknown as [
      string,
      { autoConnect: boolean; withCredentials: boolean },
    ];
    expect(url).toBe('/chat');
    expect(opts.autoConnect).toBe(false);
  });

  it('sends credentials so the httpOnly access-token cookie rides the handshake', () => {
    createNamespaceSocket('notifications');
    const opts = ioMock.mock.calls[0][1] as { withCredentials: boolean };
    expect(opts.withCredentials).toBe(true);
  });
});
