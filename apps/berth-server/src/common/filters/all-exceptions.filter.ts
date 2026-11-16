import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('Exception');
  private readonly isProd = process.env.NODE_ENV === 'production';

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const requestId = response.locals?.requestId as string | undefined;

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      response.status(status).json(exception.getResponse());
      return;
    }

    this.logger.error(
      `[${requestId ?? 'no-request-id'}] Unhandled exception`,
      exception as Error,
    );
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Internal Server Error',
      requestId,
      message: this.isProd
        ? 'Something went wrong'
        : String((exception as Error)?.message ?? exception),
    });
  }
}
