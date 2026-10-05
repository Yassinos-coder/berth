import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { MetricReading } from '../interfaces';

@Injectable()
export class MetricSampleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async history(orgId: string, serviceId: string, since: Date): Promise<MetricReading[]> {
    const rows = await this.prisma.metricSample.findMany({
      where: { serviceId, ts: { gte: since }, service: { orgId } },
      orderBy: { ts: 'asc' },
      select: { ts: true, cpuPct: true, memMb: true, netRxMb: true, netTxMb: true },
    });
    return rows.map((row) => ({ ...row, ts: row.ts.getTime() }));
  }

  async createMany(
    rows: { serviceId: string; ts: Date; cpuPct: number; memMb: number; netRxMb: number; netTxMb: number }[],
  ): Promise<void> {
    if (rows.length === 0) return;
    await this.prisma.metricSample.createMany({ data: rows });
  }

  async prune(before: Date): Promise<number> {
    const result = await this.prisma.metricSample.deleteMany({ where: { ts: { lt: before } } });
    return result.count;
  }

  serviceLimits(ids: string[]) {
    return this.prisma.service.findMany({
      where: { id: { in: ids } },
      select: { id: true, name: true, orgId: true, cpuCores: true, memoryMb: true },
    });
  }

  serverInfo(serverId: string) {
    return this.prisma.server.findUnique({
      where: { id: serverId },
      select: { name: true, orgId: true },
    });
  }
}
