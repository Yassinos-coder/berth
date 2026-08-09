import { forwardRef, Module } from '@nestjs/common';
import { GithubAppModule } from '../github-app/github-app.module';
import { ActivityModule } from '../activity/activity.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { CaService } from './pki/ca.service';
import { EnrollmentService } from './pki/enrollment.service';
import { AgentGatewayService } from './gateway/agent-gateway.service';
import { AgentRegistry } from './registry/agent-registry.service';
import { AgentMessageHandler } from './handlers/agent-message.handler';
import { TelemetryBuffer } from './buffers/telemetry-buffer.service';
import { ReconcileRepository } from './reconcile/reconcile.repository';
import { ReconcilePlanner } from './reconcile/reconcile-planner.service';
import { SmartResourceService } from './resources/smart-resource.service';
import { AuthModule } from '../auth/auth.module';
import { ExecSessionService } from './exec/exec-session.service';
import { BrowserExecGateway } from './gateway/browser-exec-gateway.service';
import { SourceIntegrationsModule } from '../source-integrations/source-integrations.module';

@Module({
  imports: [forwardRef(() => GithubAppModule), AuthModule, ActivityModule, NotificationsModule, SourceIntegrationsModule],
  providers: [
    CaService,
    EnrollmentService,
    AgentGatewayService,
    AgentRegistry,
    AgentMessageHandler,
    TelemetryBuffer,
    ReconcileRepository,
    ReconcilePlanner,
    SmartResourceService,
    ExecSessionService,
    BrowserExecGateway,
  ],
  exports: [AgentRegistry, TelemetryBuffer],
})
export class AgentGatewayModule {}
