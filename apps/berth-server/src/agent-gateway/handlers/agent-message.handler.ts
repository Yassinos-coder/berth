import { Injectable, Logger } from '@nestjs/common';
import { AgentStatus, ServiceState } from '@prisma/client';
import type { AgentToPanel, ServerSpecs } from '@berth/protocol';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryBuffer } from '../buffers/telemetry-buffer.service';

@Injectable()
export class AgentMessageHandler {
  private readonly logger = new Logger(AgentMessageHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetry: TelemetryBuffer,
  ) {}

  async handle(serverId: string, message: AgentToPanel): Promise<void> {
    switch (message.type) {
      case 'Enrolled':
        await this.onEnrolled(serverId, message.serverSpecs);
        return;
      case 'ServiceStatus':
        await this.onServiceStatus(serverId, message.serviceId, message.state);
        return;
      case 'LogChunk':
        this.telemetry.appendLog(message.serviceId, {
          id: `${message.ts}-${randomSuffix()}`,
          ts: message.ts,
          stream: 'stdout',
          line: message.line,
        });
        return;
      case 'BuildProgress':
        this.telemetry.appendLog(message.serviceId, {
          id: `${Date.now()}-${randomSuffix()}`,
          ts: Date.now(),
          stream: 'build',
          line: message.logChunk,
        });
        return;
      case 'Metrics':
        this.telemetry.appendMetric(message.serviceId, {
          ts: Date.now(),
          cpuPct: message.cpuPct,
          memMb: message.memMb,
        });
        return;
      case 'ReconcileResult':
        if (message.failed.length > 0) {
          this.logger.warn(
            `reconcile on ${serverId} reported ${message.failed.length} failure(s)`,
          );
        }
        return;
    }
  }

  private async onEnrolled(
    serverId: string,
    specs: ServerSpecs,
  ): Promise<void> {
    await this.prisma.server.updateMany({
      where: { id: serverId },
      data: {
        status: AgentStatus.online,
        os: specs.os,
        cpuCores: specs.cpuCores,
        memoryMb: specs.memoryMb,
        diskGb: specs.diskGb,
        lastSeenAt: new Date(),
      },
    });
  }

  private async onServiceStatus(
    serverId: string,
    serviceId: string,
    state: string,
  ): Promise<void> {
    await this.prisma.service.updateMany({
      where: { id: serviceId, serverId },
      data: { state: state as ServiceState },
    });
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
