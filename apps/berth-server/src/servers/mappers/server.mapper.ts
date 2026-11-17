import { Server } from '@prisma/client';
import type { ServerDto } from '../interfaces';
import { StorageBudgetValidator } from '../../common/validators/storage-budget.validator';

type ServerWithCount = Server & { _count?: { services: number } };

export class ServerMapper {
  static toDto(server: ServerWithCount, allocatedDiskGb = 0): ServerDto {
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
      storage: StorageBudgetValidator.summarize(server.storageBudgetGb, allocatedDiskGb),
      usage: {
        cpuPct: 0,
        memMb: 0,
        memTotalMb: server.memoryMb,
        diskGb: server.diskUsedGb,
        diskTotalGb: server.diskGb,
      },
      lastSeen: server.lastSeenAt.toISOString(),
      createdAt: server.createdAt.toISOString(),
    };
  }
}
