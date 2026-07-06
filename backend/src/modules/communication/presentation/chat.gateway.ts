import { HttpException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AccessTokenPayload, AuthUser } from '../../../core/auth/auth-user';
import { AppConfigService } from '../../../core/config/app-config.service';
import { ConversationsService } from '../application/conversations.service';
import { MessagesService } from '../application/messages.service';
import { WsRateLimiter } from './ws-rate-limiter';

/** Ack envelope: the WS mirror of the HTTP {success,data,error} contract. */
interface WsAck<T> {
  success: boolean;
  data: T | null;
  error: { code: string; message: string } | null;
}

interface JoinPayload {
  conversationId?: string;
}

interface SendPayload {
  conversationId?: string;
  content?: string;
}

/** socket.data is `any` in socket.io's types; funnel access through here. */
interface SocketData {
  user?: AuthUser;
}

const room = (conversationId: string): string =>
  `conversation:${conversationId}`;

const ok = <T>(data: T): WsAck<T> => ({ success: true, data, error: null });

const fail = (code: string, message: string): WsAck<never> => ({
  success: false,
  data: null,
  error: { code, message },
});

const INVALID_PAYLOAD = fail(
  'INVALID_PAYLOAD',
  'El evento no tiene la forma esperada.',
);

/**
 * Handlers are bound before the async handshake verification resolves, so a
 * too-eager client can race its first event; this code tells it to retry.
 */
const NOT_AUTHENTICATED = fail(
  'NOT_AUTHENTICATED',
  'La conexión aún no está autenticada.',
);

const RATE_LIMITED = fail(
  'RATE_LIMITED',
  'Demasiados eventos; espera unos segundos.',
);

/** Global pipes never run for WS handlers: ids are shape-checked here. */
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Chat frames are tiny; the Socket.IO default (1 MB) invites abuse. */
const MAX_WS_FRAME_BYTES = 16 * 1024;

/**
 * Realtime chat adapter (docs/arquitectura.md §6.3). Pure presentation: it
 * authenticates the socket (JWT in the handshake, same HS256 pin as HTTP)
 * and delegates every decision to the application services — joining a room
 * goes through the same getAccess() gate as the REST history, so a socket
 * can never observe a conversation its user could not read over HTTP.
 */
@WebSocketGateway({ namespace: 'chat', maxHttpBufferSize: MAX_WS_FRAME_BYTES })
export class ChatGateway implements OnGatewayConnection {
  private readonly logger = new Logger(ChatGateway.name);

  @WebSocketServer()
  private readonly server!: Server;

  private readonly rateLimiter = new WsRateLimiter();

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
    private readonly conversations: ConversationsService,
    private readonly messages: MessagesService,
  ) {}

  /**
   * Shared preamble of every event handler: authenticated socket, per-user
   * event budget (mirrors the HTTP throttler, which cannot see WS handlers;
   * off in tests like it), and a UUID-shaped conversation id (global pipes
   * do not run here either).
   */
  private precheck(
    socket: Socket,
    conversationId: unknown,
  ): { user: AuthUser } | { reject: WsAck<never> } {
    const user = this.socketUser(socket);
    if (!user) {
      return { reject: NOT_AUTHENTICATED };
    }
    if (
      this.config.nodeEnv !== 'test' &&
      !this.rateLimiter.allow(user.userId)
    ) {
      return { reject: RATE_LIMITED };
    }
    if (typeof conversationId !== 'string' || !UUID_PATTERN.test(conversationId)) {
      return { reject: INVALID_PAYLOAD };
    }
    return { user };
  }

  /** Unauthenticated sockets are dropped before any event handler runs. */
  async handleConnection(socket: Socket): Promise<void> {
    const token = this.extractToken(socket);
    if (!token) {
      socket.disconnect(true);
      return;
    }
    try {
      const payload = await this.jwtService.verifyAsync<AccessTokenPayload>(
        token,
        {
          secret: this.config.jwtAccessSecret,
          algorithms: ['HS256'],
        },
      );
      (socket.data as SocketData).user = { userId: payload.sub, role: payload.role };
    } catch {
      socket.disconnect(true);
    }
  }

  @SubscribeMessage('conversation:join')
  async join(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinPayload,
  ): Promise<WsAck<{ conversationId: string }>> {
    const check = this.precheck(socket, payload?.conversationId);
    if ('reject' in check) {
      return check.reject;
    }
    return this.guarded(async () => {
      // Exit criterion F8: a foreign user 404s here and never joins the room.
      const access = await this.conversations.getAccess(
        payload.conversationId as string,
        check.user.userId,
      );
      await socket.join(room(access.conversationId));
      return { conversationId: access.conversationId };
    });
  }

  @SubscribeMessage('conversation:leave')
  async leave(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinPayload,
  ): Promise<WsAck<{ conversationId: string }>> {
    const check = this.precheck(socket, payload?.conversationId);
    if ('reject' in check) {
      return check.reject;
    }
    await socket.leave(room(payload.conversationId as string));
    return ok({ conversationId: payload.conversationId as string });
  }

  @SubscribeMessage('message:send')
  async send(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: SendPayload,
  ): Promise<WsAck<unknown>> {
    const check = this.precheck(socket, payload?.conversationId);
    if ('reject' in check) {
      return check.reject;
    }
    if (typeof payload?.content !== 'string') {
      return INVALID_PAYLOAD;
    }
    return this.guarded(async () => {
      const view = await this.messages.send(
        payload.conversationId as string,
        check.user.userId,
        payload.content as string,
      );
      this.server.to(room(view.conversationId)).emit('message:new', view);
      return view;
    });
  }

  @SubscribeMessage('conversation:read')
  async read(
    @ConnectedSocket() socket: Socket,
    @MessageBody() payload: JoinPayload,
  ): Promise<WsAck<{ updated: number }>> {
    const check = this.precheck(socket, payload?.conversationId);
    if ('reject' in check) {
      return check.reject;
    }
    return this.guarded(async () => {
      const conversationId = payload.conversationId as string;
      const updated = await this.conversations.markRead(
        conversationId,
        check.user.userId,
      );
      if (updated > 0) {
        this.server.to(room(conversationId)).emit('message:read', {
          conversationId,
          readerId: check.user.userId,
          updated,
        });
      }
      return { updated };
    });
  }

  /** Maps application exceptions to the ack envelope instead of crashing the socket. */
  private async guarded<T>(fn: () => Promise<T>): Promise<WsAck<T>> {
    try {
      return ok(await fn());
    } catch (error) {
      if (error instanceof HttpException) {
        const response = error.getResponse() as
          | { code?: string; message?: string }
          | string;
        if (typeof response === 'object' && response.code) {
          return fail(response.code, response.message ?? 'Error');
        }
        return fail('ERROR', error.message);
      }
      this.logger.error('Unexpected WS error', error as Error);
      return fail('INTERNAL_ERROR', 'Ocurrió un error inesperado.');
    }
  }

  private socketUser(socket: Socket): AuthUser | undefined {
    return (socket.data as SocketData).user;
  }

  private extractToken(socket: Socket): string | undefined {
    const auth = (socket.handshake.auth as { token?: unknown } | undefined)
      ?.token;
    if (typeof auth === 'string' && auth.length > 0) {
      return auth;
    }
    const header = socket.handshake.headers.authorization;
    const [scheme, token] = header?.split(' ') ?? [];
    return scheme === 'Bearer' ? token : undefined;
  }
}
