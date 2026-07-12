import { Server, Service } from '@prisma/client';
import type { ServiceSource } from '@berth/protocol';
import type { ServiceDto } from '../interfaces';

type ServiceWithServer = Service & { server: Pick<Server, 'name'> };

export class ServiceMapper {
  static toDto(service: ServiceWithServer): ServiceDto {
    return {
      id: service.id,
      name: service.name,
      kind: service.kind,
      state: service.state,
      serverId: service.serverId,
      serverName: service.server.name,
      source: ServiceMapper.toSource(service),
      resources: {
        cpuCores: service.cpuCores,
        memoryMb: service.memoryMb,
        cpuShares: service.cpuShares ?? undefined,
      },
      replicas: service.replicas,
      domain: service.domain ?? undefined,
      templateKind: service.templateKind ?? undefined,
      usage: { cpuPct: 0, memMb: 0 },
      lastDeployedAt: service.lastDeployedAt?.toISOString(),
      createdAt: service.createdAt.toISOString(),
    };
  }

  private static toSource(service: Service): ServiceSource {
    if (service.sourceKind === 'git') {
      return {
        kind: 'git',
        repo: service.repo ?? '',
        branch: service.branch ?? 'main',
        build: {
          builder: service.builder ?? 'auto',
          dockerfilePath: service.dockerfilePath ?? undefined,
        },
      };
    }
    return {
      kind: 'image',
      image: service.image ?? '',
      tag: service.tag ?? 'latest',
    };
  }
}
