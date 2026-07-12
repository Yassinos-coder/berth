import { Injectable } from '@nestjs/common';
import {
  Builder,
  Prisma,
  Server,
  Service,
  ServiceKind,
  ServiceState,
  SourceKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type ServiceWithServer = Service & { server: Pick<Server, 'name'> };

const withServer = {
  server: { select: { name: true } },
} satisfies Prisma.ServiceInclude;

@Injectable()
export class ServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<ServiceWithServer[]> {
    return this.prisma.service.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: withServer,
    });
  }

  findById(orgId: string, id: string): Promise<ServiceWithServer | null> {
    return this.prisma.service.findFirst({
      where: { id, orgId },
      include: withServer,
    });
  }

  findWithConnection(orgId: string, id: string) {
    return this.prisma.service.findFirst({
      where: { id, orgId },
      include: {
        envVars: true,
        server: { select: { name: true, ip: true } },
      },
    });
  }

  create(data: {
    orgId: string;
    serverId: string;
    name: string;
    kind: ServiceKind;
    sourceKind: SourceKind;
    image?: string;
    tag?: string;
    repo?: string;
    branch?: string;
    builder?: Builder;
    dockerfilePath?: string;
    cpuCores: number;
    memoryMb: number;
    cpuShares?: number;
    domain?: string;
    templateKind?: string;
    containerPort?: number;
    publicNetworking?: boolean;
    volumeName?: string;
    volumePath?: string;
    env?: { key: string; value: string; isSecret: boolean }[];
  }): Promise<ServiceWithServer> {
    const { env, ...fields } = data;
    return this.prisma.service.create({
      data: {
        ...fields,
        state: ServiceState.starting,
        lastDeployedAt: new Date(),
        envVars:
          env && env.length > 0
            ? {
                create: env.map((item) => ({
                  key: item.key,
                  value: item.value,
                  isSecret: item.isSecret,
                })),
              }
            : undefined,
      },
      include: withServer,
    });
  }

  updateState(
    orgId: string,
    id: string,
    state: ServiceState,
  ): Promise<Prisma.BatchPayload> {
    return this.prisma.service.updateMany({
      where: { id, orgId },
      data: { state, lastDeployedAt: new Date() },
    });
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const result = await this.prisma.service.deleteMany({
      where: { id, orgId },
    });
    return result.count > 0;
  }
}
