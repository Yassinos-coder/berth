import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { RequestIdUtil } from '../utils/request-id.util';
import { RequestContext } from '../utils/request-context.util';

const logger = new Logger('HTTP');

export function httpLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const requestId = RequestIdUtil.resolve(req.headers['x-request-id'], randomUUID);
  res.locals.requestId = requestId;
  res.setHeader('x-request-id', requestId);

  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.log(
      `[${requestId}] ${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`,
    );
  });
  RequestContext.run(requestId, next);
}
