import { Injectable } from '@nestjs/common';
import { NotificationChannel, NotificationChannelKind } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface CreateNotificationChannelData {
  orgId: string;
  name: string;
  kind: NotificationChannelKind;
  webhookUrl?: string;
  webhookSecret?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPasswordEncrypted?: string;
  emailFrom?: string;
  emailTo?: string;
}

@Injectable()
export class NotificationChannelRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<NotificationChannel[]> {
    return this.prisma.notificationChannel.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  listEnabledByOrg(orgId: string): Promise<NotificationChannel[]> {
    return this.prisma.notificationChannel.findMany({
      where: { orgId, enabled: true },
    });
  }

  findById(orgId: string, id: string): Promise<NotificationChannel | null> {
    return this.prisma.notificationChannel.findFirst({
      where: { id, orgId },
    });
  }

  create(data: CreateNotificationChannelData): Promise<NotificationChannel> {
    return this.prisma.notificationChannel.create({ data });
  }

  async setEnabled(
    orgId: string,
    id: string,
    enabled: boolean,
  ): Promise<boolean> {
    const result = await this.prisma.notificationChannel.updateMany({
      where: { id, orgId },
      data: { enabled },
    });
    return result.count > 0;
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const result = await this.prisma.notificationChannel.deleteMany({
      where: { id, orgId },
    });
    return result.count > 0;
  }
}
