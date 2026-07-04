import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';

function assertProductionSecrets(): void {
  if (process.env.NODE_ENV !== 'production') return;
  const weak = (value?: string) => !value || value.includes('dev-only');
  if (weak(process.env.JWT_SECRET) || weak(process.env.BERTH_MASTER_KEY)) {
    throw new Error(
      'Refusing to start: JWT_SECRET and BERTH_MASTER_KEY must be set to strong values in production',
    );
  }
}

async function bootstrap(): Promise<void> {
  assertProductionSecrets();

  const app = await NestFactory.create(AppModule, { cors: false });
  const corsOrigin = process.env.BERTH_CORS_ORIGIN ?? 'http://localhost:3000';

  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: corsOrigin, credentials: true });
  (app.getHttpAdapter().getInstance() as { disable: (k: string) => void }).disable(
    'x-powered-by',
  );

  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port);
  new Logger('Bootstrap').log(
    `berth-server listening on http://localhost:${port}/api`,
  );
}

void bootstrap();
