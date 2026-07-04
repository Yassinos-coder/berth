import { Module } from '@nestjs/common';
import { CaService } from './pki/ca.service';
import { EnrollmentService } from './pki/enrollment.service';
import { AgentGatewayService } from './gateway/agent-gateway.service';
import { AgentRegistry } from './registry/agent-registry.service';
import { AgentMessageHandler } from './handlers/agent-message.handler';
import { TelemetryBuffer } from './buffers/telemetry-buffer.service';
import { ReconcileRepository } from './reconcile/reconcile.repository';
import { ReconcilePlanner } from './reconcile/reconcile-planner.service';

@Module({
  providers: [
    CaService,
    EnrollmentService,
    AgentGatewayService,
    AgentRegistry,
    AgentMessageHandler,
    TelemetryBuffer,
    ReconcileRepository,
    ReconcilePlanner,
  ],
  exports: [AgentRegistry, TelemetryBuffer],
})
export class AgentGatewayModule {}
