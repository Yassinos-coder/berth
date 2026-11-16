import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ShieldModule } from 'nestjs-shield';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { FleetModule } from './domains/fleet.module';
import { DeliveryModule } from './domains/delivery.module';
import { EdgeModule } from './domains/edge.module';
import { OperationsModule } from './domains/operations.module';
import { AccessModule } from './domains/access.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['../../.env'],
      load: [configuration],
    }),
    ShieldModule.forRoot({
      rateLimit: { algorithm: 'token-bucket', limit: 120, ttl: 60_000 },
      autoBan: {
        threshold: 20,
        window: 60_000,
        banDuration: 5 * 60_000,
        escalate: true,
        maxBanDuration: 60 * 60_000,
      },
      slowDown: { delayAfter: 60, delayMs: 250, maxDelayMs: 2_000 },
      payload: { maxBodyBytes: 1_000_000 },
    }),
    PrismaModule,
    CryptoModule,
    FleetModule,
    DeliveryModule,
    EdgeModule,
    OperationsModule,
    AccessModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
