import { Injectable } from '@nestjs/common';
import type { VolumeUsageEntry } from '@berth/protocol';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { VolumeUsageRules } from './volume-usage.rules';

@Injectable()
export class VolumeUsageService {
  private readonly alertedAt = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationsService,
  ) {}

  async record(serverId: string, volumes: VolumeUsageEntry[], now = Date.now()): Promise<void> {
    for (const entry of volumes) {
      if (!VolumeUsageRules.sane(entry)) continue;
      const services = await this.prisma.service.findMany({
        where: { serverId, volumeName: { in: VolumeUsageRules.candidateNames(entry.name) } },
        select: { id: true, name: true, orgId: true },
      });
      for (const service of services) {
        await this.prisma.service.update({
          where: { id: service.id },
          data: {
            volumeUsedMb: Math.round(entry.usedMb),
            volumeTotalMb: Math.round(entry.totalMb),
            volumeUsageAt: new Date(now),
          },
        });
        await this.alertIfFull(service, entry, now);
      }
    }
  }

  private async alertIfFull(
    service: { id: string; name: string; orgId: string },
    entry: VolumeUsageEntry,
    now: number,
  ): Promise<void> {
    const percent = VolumeUsageRules.percent(entry.usedMb, entry.totalMb);
    if (!VolumeUsageRules.shouldAlert(percent, this.alertedAt.get(service.id), now)) return;
    this.alertedAt.set(service.id, now);
    await this.notifications.notify(service.orgId, {
      type: 'resource.high',
      title: `Storage almost full on ${service.name}`,
      detail: `${service.name} has used ${percent}% of its storage limit. Writes fail when it is full, so increase its size in the service's Settings.`,
      severity: 'warning',
    });
  }
}
