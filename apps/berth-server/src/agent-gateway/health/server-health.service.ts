import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { AgentStatus } from '@prisma/client';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ServerHealthRules } from './server-health.rules';

const SWEEP_MS = 30_000;

@Injectable()
export class ServerHealthService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ServerHealthService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    if (process.env.NODE_ENV === 'test') return;
    this.timer = setInterval(() => void this.sweep(), SWEEP_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async sweep(now = Date.now()): Promise<void> {
    const offline = await this.prisma.server
      .findMany({
        where: { status: AgentStatus.offline, offlineAlertedAt: null },
        select: { id: true, orgId: true, name: true, status: true, lastSeenAt: true, offlineAlertedAt: true },
      })
      .catch(() => []);

    for (const server of offline) {
      if (!ServerHealthRules.dueForOfflineAlert(server, now)) continue;
      const claimed = await this.prisma.server.updateMany({
        where: { id: server.id, offlineAlertedAt: null, status: AgentStatus.offline },
        data: { offlineAlertedAt: new Date(now) },
      });
      if (claimed.count === 0) continue;
      await this.notifications
        .notify(server.orgId, {
          type: 'server.offline',
          title: `${server.name} is offline`,
          detail: `Berth has not heard from ${server.name} for ${ServerHealthRules.offlineFor(server, now)}. Its services may be down. Check the server and the berth-agent service.`,
          severity: 'error',
        })
        .catch((error: unknown) => this.logger.warn(`offline alert failed: ${error instanceof Error ? error.message : 'unknown'}`));
    }
  }

  async onConnected(serverId: string, now = Date.now()): Promise<void> {
    const server = await this.prisma.server
      .findUnique({ where: { id: serverId }, select: { orgId: true, name: true, offlineAlertedAt: true } })
      .catch(() => null);
    if (!server?.offlineAlertedAt) return;

    const cleared = await this.prisma.server.updateMany({
      where: { id: serverId, offlineAlertedAt: { not: null } },
      data: { offlineAlertedAt: null },
    });
    if (cleared.count === 0) return;
    const away = ServerHealthRules.offlineFor({ lastSeenAt: server.offlineAlertedAt }, now);
    await this.notifications
      .notify(server.orgId, {
        type: 'server.online',
        title: `${server.name} is back online`,
        detail: `${server.name} reconnected after about ${away}.`,
        severity: 'info',
      })
      .catch(() => undefined);
  }
}
