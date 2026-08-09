import { NotificationChannel } from '@prisma/client';
import type { NotificationChannelDto } from '../interfaces';

export class NotificationChannelMapper {
  static toDto(channel: NotificationChannel): NotificationChannelDto {
    return {
      id: channel.id,
      name: channel.name,
      kind: channel.kind,
      enabled: channel.enabled,
      webhookUrl: channel.webhookUrl ?? undefined,
      smtpHost: channel.smtpHost ?? undefined,
      smtpPort: channel.smtpPort ?? undefined,
      smtpUser: channel.smtpUser ?? undefined,
      emailFrom: channel.emailFrom ?? undefined,
      emailTo: channel.emailTo ?? undefined,
      createdAt: channel.createdAt.toISOString(),
    };
  }
}
