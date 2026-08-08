import { Injectable } from '@nestjs/common';
import { Prisma, ProxyHost } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ProxyHostWithService = ProxyHost & {
  service: { name: string; serverId: string };
};

const withService = {
  service: { select: { name: true, serverId: true } },
} satisfies Prisma.ProxyHostInclude;

@Injectable()
export class ProxyHostRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<ProxyHostWithService[]> {
    return this.prisma.proxyHost.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: withService,
    });
  }

  findById(orgId: string, id: string): Promise<ProxyHostWithService | null> {
    return this.prisma.proxyHost.findFirst({
      where: { id, orgId },
      include: withService,
    });
  }

  serviceForOrg(orgId: string, serviceId: string) {
    return this.prisma.service.findFirst({
      where: { id: serviceId, orgId },
      select: { id: true, serverId: true, containerPort: true },
    });
  }

  create(data: {
    orgId: string;
    serviceId: string;
    domain: string;
    targetPort: number;
    ssl: boolean;
    forceHttps: boolean;
  }): Promise<ProxyHostWithService> {
    return this.prisma.proxyHost.create({ data, include: withService });
  }

  async update(
    orgId: string,
    id: string,
    data: {
      domain?: string;
      targetPort?: number;
      ssl?: boolean;
      forceHttps?: boolean;
    },
  ): Promise<ProxyHostWithService | null> {
    const result = await this.prisma.proxyHost.updateMany({
      where: { id, orgId },
      data,
    });
    if (result.count === 0) return null;
    return this.findById(orgId, id);
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const result = await this.prisma.proxyHost.deleteMany({
      where: { id, orgId },
    });
    return result.count > 0;
  }
}
