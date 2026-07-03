import { Injectable } from '@nestjs/common';
import {
  Deployment,
  DeploymentStatus,
  DeploymentTrigger,
  Prisma,
  Service,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type DeploymentWithService = Deployment & { service: Pick<Service, 'name'> };

const withService = {
  service: { select: { name: true } },
} satisfies Prisma.DeploymentInclude;

@Injectable()
export class DeploymentRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<DeploymentWithService[]> {
    return this.prisma.deployment.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: withService,
      take: 100,
    });
  }

  listByService(
    orgId: string,
    serviceId: string,
  ): Promise<DeploymentWithService[]> {
    return this.prisma.deployment.findMany({
      where: { orgId, serviceId },
      orderBy: { createdAt: 'desc' },
      include: withService,
    });
  }

  findById(orgId: string, id: string): Promise<Deployment | null> {
    return this.prisma.deployment.findFirst({ where: { id, orgId } });
  }

  create(data: {
    orgId: string;
    serviceId: string;
    status: DeploymentStatus;
    trigger: DeploymentTrigger;
    branch?: string;
    commitSha?: string;
    commitMessage?: string;
    author?: string;
  }): Promise<Deployment> {
    return this.prisma.deployment.create({ data });
  }
}
