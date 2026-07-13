import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Structured, one-line-per-request JSON access log with a correlation id.
 *
 * Deliberately dependency-free (no pino/winston): a portfolio monolith does
 * not need a logging framework, and NestJS's `Logger` already routes to the
 * process transport. The id is taken from an inbound `X-Request-Id` (trusted
 * proxy) or generated, and echoed back so clients/proxies can correlate.
 *
 * Never logs bodies, headers, query strings or tokens — only request-line
 * metadata (docs/security.md A14: no secrets in logs).
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const logger = new Logger('HTTP');
  const inbound = req.headers[REQUEST_ID_HEADER];
  const requestId =
    (typeof inbound === 'string' && inbound.length > 0 && inbound.length <= 200
      ? inbound
      : undefined) ?? randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);

  const startedAt = Date.now();
  res.on('finish', () => {
    logger.log(
      JSON.stringify({
        reqId: requestId,
        method: req.method,
        // Path only — strip the query string so no value ever reaches the log.
        path: req.originalUrl.split('?', 1)[0],
        status: res.statusCode,
        durationMs: Date.now() - startedAt,
      }),
    );
  });

  next();
}
