import { JwtService } from '@nestjs/jwt';
import { Socket } from 'socket.io';
import { AccessTokenPayload, AuthUser } from '../../../core/auth/auth-user';
import { AppConfigService } from '../../../core/config/app-config.service';

/** socket.data is `any` in socket.io's types; funnel access through here. */
export interface SocketData {
  user?: AuthUser;
}

/**
 * Shared handshake authentication for every WS gateway in the module (chat,
 * notifications): same HS256 pin and secret as HTTP. Returns null instead of
 * throwing so gateways can drop the socket their own way.
 */
export async function authenticateSocket(
  socket: Socket,
  jwtService: JwtService,
  config: AppConfigService,
): Promise<AuthUser | null> {
  const token = extractToken(socket);
  if (!token) {
    return null;
  }
  try {
    const payload = await jwtService.verifyAsync<AccessTokenPayload>(token, {
      secret: config.jwtAccessSecret,
      algorithms: ['HS256'],
    });
    return { userId: payload.sub, role: payload.role };
  } catch {
    return null;
  }
}

export function socketUser(socket: Socket): AuthUser | undefined {
  return (socket.data as SocketData).user;
}

function extractToken(socket: Socket): string | undefined {
  const auth = (socket.handshake.auth as { token?: unknown } | undefined)
    ?.token;
  if (typeof auth === 'string' && auth.length > 0) {
    return auth;
  }
  const header = socket.handshake.headers.authorization;
  const [scheme, token] = header?.split(' ') ?? [];
  if (scheme === 'Bearer' && token) {
    return token;
  }
  // Browser clients: the httpOnly `access_token` cookie rides the same-origin
  // handshake automatically (docs/security.md A2). The `auth.token`/Bearer
  // paths above remain for programmatic clients and tests.
  return cookieToken(socket, 'access_token');
}

function cookieToken(socket: Socket, name: string): string | undefined {
  const raw = socket.handshake.headers.cookie;
  if (!raw) {
    return undefined;
  }
  for (const part of raw.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name && rest.length > 0) {
      return decodeURIComponent(rest.join('='));
    }
  }
  return undefined;
}
