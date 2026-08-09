import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AgentStatus, DeploymentStatus, ServiceState } from '@prisma/client';
import type { AgentToPanel, ServerSpecs } from '@berth/protocol';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryBuffer } from '../buffers/telemetry-buffer.service';
import type { AppConfig } from '../../config/configuration';
import { SmartResourceService } from '../resources/smart-resource.service';

@Injectable()
export class AgentMessageHandler {
  private readonly logger = new Logger(AgentMessageHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetry: TelemetryBuffer,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly smartResources: SmartResourceService,
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
          netRxMb: message.netRxMb,
          netTxMb: message.netTxMb,
        });
        await this.smartResources.observe(message.serviceId, message.memMb);
        return;
      case 'HostUsage':
        await this.prisma.server.updateMany({
          where: { id: serverId },
          data: {
            diskUsedGb: message.diskUsedGb,
            diskGb: Math.round(message.diskTotalGb),
          },
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
    const localHostname = this.config.get('localHostname', { infer: true });
    const isPanelHost = Boolean(
      localHostname && specs.hostname === localHostname,
    );
    await this.prisma.server.updateMany({
      where: { id: serverId },
      data: {
        status: AgentStatus.online,
        os: specs.os,
        cpuCores: specs.cpuCores,
        memoryMb: specs.memoryMb,
        diskGb: specs.diskGb,
        lastSeenAt: new Date(),
        ...(isPanelHost ? { isLocal: true } : {}),
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
    if (state === ServiceState.running || state === ServiceState.crashed) {
      const deployment = await this.prisma.deployment.findFirst({
        where: {
          serviceId,
          status: { in: [DeploymentStatus.queued, DeploymentStatus.building, DeploymentStatus.deploying] },
        },
        orderBy: { createdAt: 'desc' },
      });
      if (deployment) {
        const durationSeconds = Math.max(0, Math.round((Date.now() - deployment.createdAt.getTime()) / 1000));
        await this.prisma.deployment.update({
          where: { id: deployment.id },
          data: { status: state === ServiceState.running ? DeploymentStatus.live : DeploymentStatus.failed, durationSeconds },
        });
      }
    }
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}
