import { Injectable } from '@nestjs/common';
import { EnvVar, RegistryCredential, Service } from '@prisma/client';
import type { PanelRoute, ProxyRoute } from '@berth/protocol';
import { PrismaService } from '../../prisma/prisma.service';

export type ServiceWithEnv = Service & {
  envVars: EnvVar[];
  registryCredential: RegistryCredential | null;
};

@Injectable()
export class ReconcileRepository {
  constructor(private readonly prisma: PrismaService) {}

  servicesForServer(serverId: string): Promise<ServiceWithEnv[]> {
    return this.prisma.service.findMany({
      where: { serverId },
      include: {
        // The agent hashes the serialized spec, so environment ordering must
        // be deterministic or identical deploys can trigger rebuilds.
        envVars: { orderBy: { key: 'asc' } },
        registryCredential: true,
      },
    });
  }

  async serverIdForService(serviceId: string): Promise<string | null> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { serverId: true },
    });
    return service?.serverId ?? null;
  }

  async proxyRoutesForServer(serverId: string): Promise<ProxyRoute[]> {
    const hosts = await this.prisma.proxyHost.findMany({
      where: { service: { serverId } },
    });
    return hosts.map((host) => ({
      domain: host.domain,
      serviceId: host.serviceId,
      targetPort: host.targetPort,
      tls: host.ssl,
      forceHttps: host.forceHttps,
    }));
  }

  async panelRouteForServer(serverId: string): Promise<PanelRoute | undefined> {
    const server = await this.prisma.server.findFirst({
      where: { id: serverId, isLocal: true },
      select: { org: { select: { panelDomain: true } } },
    });
    const domain = server?.org.panelDomain?.trim();
    return domain ? { domain } : undefined;
  }
}
