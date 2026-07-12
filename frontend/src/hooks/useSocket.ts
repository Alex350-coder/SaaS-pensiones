import { useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import { createNamespaceSocket } from '@/lib/socket';
import { useIsAuthenticated } from '@/stores/session-store';

/** Server→client event handlers, keyed by event name. Payload is narrowed by
 *  the consumer (our gateways emit a single object per event). */
export type SocketHandlers = Record<string, (payload: unknown) => void>;

/**
 * Subscribe to a Socket.IO namespace for the lifetime of the calling component.
 * Handlers are dispatched through a ref so changing them does not re-open the
 * connection. Only connects while authenticated; disconnects on unmount or
 * sign-out. Returns the socket ref for emitting (e.g. chat send/join).
 */
export function useSocket(
  namespace: string,
  handlers: SocketHandlers,
  enabled = true,
): React.RefObject<Socket | null> {
  const isAuthenticated = useIsAuthenticated();
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!enabled || !isAuthenticated) return;

    const socket = createNamespaceSocket(namespace);
    socketRef.current = socket;
    // One dispatcher for every event: reads the latest handler from the ref.
    socket.onAny((event: string, payload: unknown) => {
      handlersRef.current[event]?.(payload);
    });
    socket.connect();

    return () => {
      socket.offAny();
      socket.disconnect();
      socketRef.current = null;
    };
  }, [namespace, enabled, isAuthenticated]);

  return socketRef;
}
