import { Injectable, Logger } from '@nestjs/common';
import { ActivityKind, DeploymentStatus, DeploymentTrigger, ServiceState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityService } from '../../activity/activity.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { AgentRegistry } from '../registry/agent-registry.service';
import { AutoRollbackValidator } from './auto-rollback.validator';

const HISTORY_DEPTH = 10;

@Injectable()
export class AutoRollbackService {
  private readonly logger = new Logger(AutoRollbackService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AgentRegistry,
    private readonly activity: ActivityService,
    private readonly notifications: NotificationsService,
  ) {}

  async onCrash(serviceId: string): Promise<boolean> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { orgId: true, name: true, sourceKind: true, autoRollback: true },
    });
    if (!service) return false;

    const deployments = await this.prisma.deployment.findMany({
      where: { serviceId },
      orderBy: { createdAt: 'desc' },
      take: HISTORY_DEPTH,
    });
    const target = AutoRollbackValidator.decide({
      autoRollback: service.autoRollback,
      sourceKind: service.sourceKind,
      now: new Date(),
      deployments,
    });
    if (!target?.commitSha) return false;

    const failing = deployments[0];
    const failingSha = failing.commitSha?.slice(0, 7) ?? 'the latest version';
    const targetSha = target.commitSha.slice(0, 7);

    await this.prisma.service.updateMany({
      where: { id: serviceId },
      data: { rollbackCommitSha: target.commitSha, state: ServiceState.building },
    });
    await this.prisma.deployment.create({
      data: {
        orgId: service.orgId,
        serviceId,
        status: DeploymentStatus.building,
        trigger: DeploymentTrigger.rollback,
        branch: target.branch ?? undefined,
        commitSha: target.commitSha,
        commitMessage: `Automatic rollback: ${failingSha} crashed after deploying`,
        author: 'berth',
      },
    });
    await this.activity.record(service.orgId, {
      kind: ActivityKind.deploy,
      title: `${service.name} rolled back automatically`,
      detail: `${failingSha} crashed shortly after going live. Restoring ${targetSha}.`,
    });
    await this.notifications.notify(service.orgId, {
      type: 'deployment.rolled_back',
      title: `${service.name} rolled back`,
      detail: `${failingSha} crashed after deploying, so Berth is restoring ${targetSha}.`,
      severity: 'warning',
    });
    this.logger.warn(`auto-rolled back ${service.name}: ${failingSha} -> ${targetSha}`);
    await this.registry.reconcileForService(serviceId, true);
    return true;
  }
}
