import { Injectable } from '@nestjs/common';
import { AgentStatus, ServiceState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class DashboardRepository {
  constructor(private readonly prisma: PrismaService) {}

  async counts(orgId: string): Promise<{
    servers: number;
    serversOnline: number;
    services: number;
    servicesRunning: number;
    deploymentsToday: number;
  }> {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const [servers, serversOnline, services, servicesRunning, deploymentsToday] =
      await Promise.all([
        this.prisma.server.count({ where: { orgId } }),
        this.prisma.server.count({
          where: { orgId, status: AgentStatus.online },
        }),
        this.prisma.service.count({ where: { orgId } }),
        this.prisma.service.count({
          where: { orgId, state: ServiceState.running },
        }),
        this.prisma.deployment.count({
          where: { orgId, createdAt: { gte: startOfDay } },
        }),
      ]);

    return { servers, serversOnline, services, servicesRunning, deploymentsToday };
  }
}
