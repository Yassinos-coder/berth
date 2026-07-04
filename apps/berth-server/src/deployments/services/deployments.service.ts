import { Injectable, NotFoundException } from '@nestjs/common';
import {
  ActivityKind,
  DeploymentStatus,
  DeploymentTrigger,
} from '@prisma/client';
import { DeploymentRepository } from '../repositories/deployment.repository';
import { DeploymentMapper } from '../mappers/deployment.mapper';
import { ActivityService } from '../../activity/activity.service';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { DeploymentDto } from '../interfaces';

@Injectable()
export class DeploymentsService {
  constructor(
    private readonly repository: DeploymentRepository,
    private readonly activityService: ActivityService,
    private readonly registry: AgentRegistry,
  ) {}

  async list(orgId: string): Promise<DeploymentDto[]> {
    const deployments = await this.repository.listByOrg(orgId);
    return deployments.map(DeploymentMapper.toDto);
  }

  async listForService(
    orgId: string,
    serviceId: string,
  ): Promise<DeploymentDto[]> {
    const deployments = await this.repository.listByService(orgId, serviceId);
    return deployments.map(DeploymentMapper.toDto);
  }

  async rollback(
    user: AuthenticatedUser,
    deploymentId: string,
  ): Promise<{ ok: boolean }> {
    const deployment = await this.repository.findById(user.orgId, deploymentId);
    if (!deployment) throw new NotFoundException('Deployment not found');

    await this.repository.create({
      orgId: user.orgId,
      serviceId: deployment.serviceId,
      status: DeploymentStatus.building,
      trigger: DeploymentTrigger.rollback,
      branch: deployment.branch ?? undefined,
      commitSha: deployment.commitSha ?? undefined,
      commitMessage: deployment.commitMessage ?? undefined,
      author: user.id,
    });

    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: 'Rollback started',
      actor: user.id,
    });

    await this.registry.reconcileForService(deployment.serviceId);
    return { ok: true };
  }
}
