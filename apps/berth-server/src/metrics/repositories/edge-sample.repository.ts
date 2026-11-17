import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { EdgeOwner, EdgeSampleRow } from '../interfaces';
import { EdgeAlertRulesUtil } from '../utils/edge-alert-rules.util';

@Injectable()
export class EdgeSampleRepository {
  constructor(private readonly prisma: PrismaService) {}

  async ownersByDomain(serverId: string, domains: string[]): Promise<Map<string, EdgeOwner>> {
    if (domains.length === 0) return new Map();
    const hosts = await this.prisma.proxyHost.findMany({
      where: { domain: { in: domains }, service: { serverId } },
      select: {
        domain: true,
        path: true,
        serviceId: true,
        orgId: true,
        service: { select: { name: true } },
      },
    });
    const byDomain = new Map<string, typeof hosts>();
    for (const host of hosts) {
      const list = byDomain.get(host.domain.toLowerCase()) ?? [];
      list.push(host);
      byDomain.set(host.domain.toLowerCase(), list);
    }
    const owners = new Map<string, EdgeOwner>();
    for (const [domain, list] of byDomain) {
      const primary = EdgeAlertRulesUtil.primaryOwner(list);
      if (primary) {
        owners.set(domain, {
          serviceId: primary.serviceId,
          serviceName: primary.service.name,
          orgId: primary.orgId,
        });
      }
    }
    return owners;
  }

  async add(rows: { serviceId: string; ts: Date; requests: number; errors4xx: number; errors5xx: number; p95Ms: number }[]): Promise<void> {
    if (rows.length === 0) return;
    await this.prisma.edgeSample.createMany({ data: rows });
  }

  recent(serviceId: string, since: Date): Promise<EdgeSampleRow[]> {
    return this.prisma.edgeSample.findMany({
      where: { serviceId, ts: { gte: since } },
      orderBy: { ts: 'asc' },
      select: { ts: true, requests: true, errors4xx: true, errors5xx: true, p95Ms: true },
    });
  }

  async inRange(orgId: string, serviceId: string, since: Date): Promise<EdgeSampleRow[] | null> {
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, orgId }, select: { id: true } });
    if (!service) return null;
    return this.recent(serviceId, since);
  }

  async prune(before: Date): Promise<void> {
    await this.prisma.edgeSample.deleteMany({ where: { ts: { lt: before } } });
  }
}
