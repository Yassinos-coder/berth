import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ShieldModule } from 'nestjs-shield';
import configuration from './config/configuration';
import { PrismaModule } from './prisma/prisma.module';
import { CryptoModule } from './common/crypto/crypto.module';
import { AgentGatewayModule } from './agent-gateway/agent-gateway.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CsrfGuard } from './common/guards/csrf.guard';
import { DashboardModule } from './dashboard/dashboard.module';
import { ServersModule } from './servers/servers.module';
import { ServicesModule } from './services/services.module';
import { DeploymentsModule } from './deployments/deployments.module';
import { TemplatesModule } from './templates/templates.module';
import { RegistryModule } from './registry/registry.module';
import { SystemModule } from './system/system.module';
import { TeamModule } from './team/team.module';
import { GithubAppModule } from './github-app/github-app.module';
import { ProxyHostsModule } from './proxy-hosts/proxy-hosts.module';
import { ApiTokensModule } from './api-tokens/api-tokens.module';
import { RegistryCredentialsModule } from './registry-credentials/registry-credentials.module';
import { BackupsModule } from './backups/backups.module';
import { NotificationsModule } from './notifications/notifications.module';
import { JobsModule } from './jobs/jobs.module';
import { ComposeModule } from './compose/compose.module';
import { EnvironmentsModule } from './environments/environments.module';
import { OpenApiModule } from './openapi/openapi.module';
import { SourceIntegrationsModule } from './source-integrations/source-integrations.module';
import { AuditModule } from './audit/audit.module';
import { StatusPagesModule } from './status-pages/status-pages.module';

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
    AgentGatewayModule,
    AuthModule,
    DashboardModule,
    ServersModule,
    ServicesModule,
    DeploymentsModule,
    TemplatesModule,
    RegistryModule,
    SystemModule,
    TeamModule,
    GithubAppModule,
    ProxyHostsModule,
    ApiTokensModule,
    RegistryCredentialsModule,
    BackupsModule,
    NotificationsModule,
    JobsModule,
    ComposeModule,
    EnvironmentsModule,
    OpenApiModule,
    SourceIntegrationsModule,
    AuditModule,
    StatusPagesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: CsrfGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
