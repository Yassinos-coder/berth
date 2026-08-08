import { forwardRef, Module } from '@nestjs/common';
import { GithubAppModule } from '../github-app/github-app.module';
import { CaService } from './pki/ca.service';
import { EnrollmentService } from './pki/enrollment.service';
import { AgentGatewayService } from './gateway/agent-gateway.service';
import { AgentRegistry } from './registry/agent-registry.service';
import { AgentMessageHandler } from './handlers/agent-message.handler';
import { TelemetryBuffer } from './buffers/telemetry-buffer.service';
import { ReconcileRepository } from './reconcile/reconcile.repository';
import { ReconcilePlanner } from './reconcile/reconcile-planner.service';
import { SmartResourceService } from './resources/smart-resource.service';

@Module({
  imports: [forwardRef(() => GithubAppModule)],
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
  ],
  exports: [AgentRegistry, TelemetryBuffer],
})
export class AgentGatewayModule {}
