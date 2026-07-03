import type { DeploymentStatus, DeploymentTrigger } from '@prisma/client';

export interface DeploymentDto {
  id: string;
  serviceId: string;
  serviceName: string;
  status: DeploymentStatus;
  trigger: DeploymentTrigger;
  branch?: string;
  commitSha?: string;
  commitMessage?: string;
  author?: string;
  durationSeconds?: number;
  createdAt: string;
}
