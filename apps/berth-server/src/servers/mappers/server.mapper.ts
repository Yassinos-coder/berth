import { Server } from '@prisma/client';
import type { ServerDto } from '../interfaces';

type ServerWithCount = Server & { _count?: { services: number } };

export class ServerMapper {
  static toDto(server: ServerWithCount): ServerDto {
    return {
      id: server.id,
      name: server.name,
      status: server.status,
      ip: server.ip,
      region: server.region,
      os: server.os,
      agentVersion: server.agentVersion,
      cpuCores: server.cpuCores,
      memoryMb: server.memoryMb,
      diskGb: server.diskGb,
      serviceCount: server._count?.services ?? 0,
      usage: {
        cpuPct: 0,
        memMb: 0,
        memTotalMb: server.memoryMb,
        diskGb: 0,
        diskTotalGb: server.diskGb,
      },
      lastSeen: server.lastSeenAt.toISOString(),
      createdAt: server.createdAt.toISOString(),
    };
  }
}
