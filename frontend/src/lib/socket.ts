import { io, type Socket } from 'socket.io-client';

/**
 * Create a disconnected Socket.IO client for a backend namespace (`chat`,
 * `notifications`). Auth rides the httpOnly `access_token` cookie sent on the
 * same-origin handshake (`withCredentials`), so no token is read in JS
 * (docs/security.md A2); a silent-refresh rotation is picked up on the next
 * reconnect because the browser sends the refreshed cookie automatically.
 * Same-origin in dev (Vite proxies `/socket.io`) and prod (nginx). Caller owns
 * connect/disconnect.
 */
export function createNamespaceSocket(namespace: string): Socket {
  return io(`/${namespace}`, {
    autoConnect: false,
    withCredentials: true,
  });
}
