import { useCallback, useEffect, useRef } from 'react';
import type { Socket } from 'socket.io-client';
import type { MessageView } from '@/lib/api-types';
import { createNamespaceSocket } from '@/lib/socket';
import { useIsAuthenticated } from '@/stores/session-store';

interface WsAck<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

export interface MessageReadEvent {
  conversationId: string;
  readerId: string;
  updated: number;
}

interface ChatSocketHandlers {
  onMessage: (message: MessageView) => void;
  onRead: (event: MessageReadEvent) => void;
}

/**
 * One `/chat` socket for the messages screen. Delivery goes through the gateway
 * (it broadcasts `message:new` to the room, including back to the sender), so
 * sending is a socket emit with an ack rather than a REST call. The active
 * conversation room is (re)joined on connect and on switch.
 */
export function useChatSocket(
  conversationId: string | null,
  handlers: ChatSocketHandlers,
) {
  const isAuthenticated = useIsAuthenticated();
  const socketRef = useRef<Socket | null>(null);
  const handlersRef = useRef(handlers);
  handlersRef.current = handlers;

  useEffect(() => {
    if (!isAuthenticated) return;
    const socket = createNamespaceSocket('chat');
    socketRef.current = socket;
    socket.on('message:new', (m: MessageView) =>
      handlersRef.current.onMessage(m),
    );
    socket.on('message:read', (e: MessageReadEvent) =>
      handlersRef.current.onRead(e),
    );
    socket.connect();
    return () => {
      socket.off('message:new');
      socket.off('message:read');
      socket.disconnect();
      socketRef.current = null;
    };
  }, [isAuthenticated]);

  useEffect(() => {
    const socket = socketRef.current;
    if (!socket || !conversationId) return;
    const join = () => socket.emit('conversation:join', { conversationId });
    if (socket.connected) join();
    socket.on('connect', join); // re-join after a reconnect
    return () => {
      socket.off('connect', join);
      if (socket.connected) {
        socket.emit('conversation:leave', { conversationId });
      }
    };
  }, [conversationId]);

  const send = useCallback(
    (content: string): Promise<WsAck<MessageView>> =>
      new Promise((resolve) => {
        const socket = socketRef.current;
        if (!socket || !conversationId) {
          resolve({
            success: false,
            data: null,
            error: { code: 'NO_SOCKET', message: 'Sin conexión con el chat.' },
          });
          return;
        }
        socket.emit(
          'message:send',
          { conversationId, content },
          (ack: WsAck<MessageView>) => resolve(ack),
        );
      }),
    [conversationId],
  );

  const markRead = useCallback(() => {
    const socket = socketRef.current;
    if (socket?.connected && conversationId) {
      socket.emit('conversation:read', { conversationId });
    }
  }, [conversationId]);

  return { send, markRead };
}
