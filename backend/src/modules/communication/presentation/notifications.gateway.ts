import { JwtService } from '@nestjs/jwt';
import {
  OnGatewayConnection,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AppConfigService } from '../../../core/config/app-config.service';
import {
  NotificationPusher,
  NotificationView,
} from '../application/notification-pusher.port';
import { authenticateSocket, SocketData } from './ws-auth';

const userRoom = (userId: string): string => `user:${userId}`;

/** The namespace is push-only; inbound frames have no reason to be large. */
const MAX_WS_FRAME_BYTES = 1024;

/**
 * Push side of the bell (roadmap F9): authenticated sockets join their own
 * user room and receive `notification:new` events while connected. The
 * gateway accepts no client events — it only implements the pusher port the
 * application services deliver through; disconnected users simply read the
 * bell over REST later.
 */
@WebSocketGateway({
  namespace: 'notifications',
  maxHttpBufferSize: MAX_WS_FRAME_BYTES,
})
export class NotificationsGateway
  implements OnGatewayConnection, NotificationPusher
{
  @WebSocketServer()
  private readonly server!: Server;

  constructor(
    private readonly jwtService: JwtService,
    private readonly config: AppConfigService,
  ) {}

  /** Same policy as the chat gateway: unauthenticated sockets are dropped. */
  async handleConnection(socket: Socket): Promise<void> {
    const user = await authenticateSocket(socket, this.jwtService, this.config);
    if (!user) {
      socket.disconnect(true);
      return;
    }
    (socket.data as SocketData).user = user;
    await socket.join(userRoom(user.userId));
  }

  push(userId: string, notification: NotificationView): void {
    // `server` is unset until the gateway initializes; a push racing app
    // startup (e.g. an early cron) must not crash the producer.
    this.server?.to(userRoom(userId)).emit('notification:new', notification);
  }
}
