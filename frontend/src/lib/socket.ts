import { io, type Socket } from 'socket.io-client';
import { useSessionStore } from '@/stores/session-store';

/**
 * Create a disconnected Socket.IO client for a backend namespace (`chat`,
 * `notifications`). The access token is read fresh on every (re)connection via
 * the `auth` callback, so a silent-refresh rotation is picked up automatically
 * on reconnect. Same-origin in dev: Vite proxies `/socket.io` to Nest, so no
 * CORS is needed (deferred to Phase 18). Caller owns connect/disconnect.
 */
export function createNamespaceSocket(namespace: string): Socket {
  return io(`/${namespace}`, {
    autoConnect: false,
    // Read the current token on each attempt; reconnects re-authenticate.
    auth: (cb) => {
      const token = useSessionStore.getState().tokens?.accessToken ?? '';
      cb({ token });
    },
  });
}
