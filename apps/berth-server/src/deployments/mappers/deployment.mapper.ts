import { Deployment, Service } from '@prisma/client';
import type { DeploymentDto } from '../interfaces';

type DeploymentWithService = Deployment & { service: Pick<Service, 'name'> };

export class DeploymentMapper {
  static toDto(deployment: DeploymentWithService): DeploymentDto {
    return {
      id: deployment.id,
      serviceId: deployment.serviceId,
      serviceName: deployment.service.name,
      status: deployment.status,
      trigger: deployment.trigger,
      branch: deployment.branch ?? undefined,
      commitSha: deployment.commitSha ?? undefined,
      commitMessage: deployment.commitMessage ?? undefined,
      author: deployment.author ?? undefined,
      durationSeconds: deployment.durationSeconds ?? undefined,
      createdAt: deployment.createdAt.toISOString(),
    };
  }
}
