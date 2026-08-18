import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityKind,
  AgentStatus,
  BackupStatus,
  DeploymentStatus,
  JobRunStatus,
  ServiceState,
} from '@prisma/client';
import type { AgentToPanel, ServerSpecs } from '@berth/protocol';
import { PrismaService } from '../../prisma/prisma.service';
import { TelemetryBuffer } from '../buffers/telemetry-buffer.service';
import type { AppConfig } from '../../config/configuration';
import { SmartResourceService } from '../resources/smart-resource.service';
import { ActivityService } from '../../activity/activity.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { ExecSessionService } from '../exec/exec-session.service';

@Injectable()
export class AgentMessageHandler {
  private readonly logger = new Logger(AgentMessageHandler.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetry: TelemetryBuffer,
    private readonly config: ConfigService<AppConfig, true>,
    private readonly smartResources: SmartResourceService,
    private readonly activityService: ActivityService,
    private readonly notifications: NotificationsService,
    private readonly exec: ExecSessionService,
  ) {}

  async handle(serverId: string, message: AgentToPanel): Promise<void> {
    switch (message.type) {
      case 'Enrolled':
        await this.onEnrolled(serverId, message.serverSpecs);
        return;
      case 'ServiceStatus':
        await this.onServiceStatus(serverId, message.serviceId, message.state, message.deployed);
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
      case 'BackupResult':
        await this.onBackupResult(message);
        return;
      case 'RestoreResult':
        await this.onRestoreResult(message);
        return;
      case 'ExecOutput':
      case 'ExecExit':
        this.exec.handle(message);
        return;
      case 'CommandResult':
        await this.prisma.jobRun.updateMany({
          where: { id: message.runId },
          data: {
            status: message.exitCode === 0 ? JobRunStatus.success : JobRunStatus.failed,
            output: message.output,
            exitCode: message.exitCode,
            finishedAt: new Date(),
          },
        });
        return;
    }
  }

  private async onBackupResult(
    message: Extract<AgentToPanel, { type: 'BackupResult' }>,
  ): Promise<void> {
    const backup = await this.prisma.backup.update({
      where: { id: message.backupId },
      data: {
        status: message.success ? BackupStatus.success : BackupStatus.failed,
        sizeBytes: message.sizeBytes ? BigInt(message.sizeBytes) : undefined,
        errorMessage: message.error,
        finishedAt: new Date(),
      },
      include: { service: { select: { name: true } } },
    });
    const title = `Backup ${message.success ? 'completed' : 'failed'} for ${backup.service.name}`;
    const detail = message.success
      ? `${formatBytes(message.sizeBytes)} uploaded`
      : (message.error ?? 'Unknown error');
    await this.activityService.record(backup.orgId, {
      kind: ActivityKind.system,
      title,
      detail,
      actor: 'agent',
    });
    if (!message.success) {
      await this.notifications.notify(backup.orgId, {
        title,
        detail,
        severity: 'error',
      });
    }
  }

  private async onRestoreResult(
    message: Extract<AgentToPanel, { type: 'RestoreResult' }>,
  ): Promise<void> {
    const service = await this.prisma.service.findUnique({
      where: { id: message.serviceId },
      select: { orgId: true, name: true },
    });
    if (!service) return;
    const title = `Restore ${message.success ? 'completed' : 'failed'} for ${service.name}`;
    const detail = message.success
      ? 'Restore finished successfully.'
      : (message.error ?? 'Unknown error');
    await this.activityService.record(service.orgId, {
      kind: ActivityKind.system,
      title,
      detail,
      actor: 'agent',
    });
    await this.notifications.notify(service.orgId, {
      title,
      detail,
      severity: message.success ? 'info' : 'error',
    });
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
    deployed: boolean,
  ): Promise<void> {
    await this.prisma.service.updateMany({
      where: { id: serviceId, serverId },
      data: { state: state as ServiceState },
    });
    if (state === ServiceState.running || state === ServiceState.crashed) {
      const service = await this.prisma.service.findUnique({
        where: { id: serviceId },
        select: { orgId: true, name: true },
      });
      if (!service) return;

      const deployment = await this.prisma.deployment.findFirst({
        where: {
          serviceId,
          status: { in: [DeploymentStatus.queued, DeploymentStatus.building, DeploymentStatus.deploying] },
        },
        orderBy: { createdAt: 'desc' },
      });
      const isRunning = state === ServiceState.running;

      if (deployment) {
        // `deployed` is only true when THIS reconcile actually cut traffic
        // over to a newly built/pulled image. A skip (already up to date)
        // or a failed build also reports the old container as `running`,
        // which must not be read as "this queued deployment went live".
        const durationSeconds = Math.max(0, Math.round((Date.now() - deployment.createdAt.getTime()) / 1000));
        await this.prisma.deployment.update({
          where: { id: deployment.id },
          data: { status: deployed ? DeploymentStatus.live : DeploymentStatus.failed, durationSeconds },
        });
        await this.notifications.notify(service.orgId, {
          type: deployed ? 'deployment.succeeded' : 'deployment.failed',
          title: deployed ? `Deployed ${service.name}` : `Deploy failed for ${service.name}`,
          detail: deployed
            ? `Live after ${durationSeconds}s`
            : `${service.name} did not deploy; the previous version is still serving.`,
          severity: deployed ? 'info' : 'error',
        });
      } else if (!isRunning) {
        await this.notifications.notify(service.orgId, {
          type: 'service.crashed',
          title: `${service.name} crashed`,
          detail: `${service.name} stopped unexpectedly and is not running.`,
          severity: 'error',
        });
      }
    }
  }
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

function formatBytes(bytes: number | undefined): string {
  if (!bytes) return '0 B';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
