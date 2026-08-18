import { Logger } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

const logger = new Logger('HTTP');

export function httpLoggerMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const start = Date.now();
  res.on('finish', () => {
    const ms = Date.now() - start;
    logger.log(`${req.method} ${req.originalUrl} ${res.statusCode} ${ms}ms`);
  });
  next();
}
