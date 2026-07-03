import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ShieldModule } from 'nestjs-shield';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { ServersModule } from './servers/servers.module';
import { ServicesModule } from './services/services.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { TemplatesModule } from './templates/templates.module';
import { TeamModule } from './team/team.module';

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
    AuthModule,
    DashboardModule,
    ServersModule,
    ServicesModule,
    DeploymentsModule,
    TemplatesModule,
    TeamModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
