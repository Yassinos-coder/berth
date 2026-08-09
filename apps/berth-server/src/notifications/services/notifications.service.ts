import { Injectable, Logger } from '@nestjs/common';
import { NotificationChannel } from '@prisma/client';
import { NotificationChannelRepository } from '../repositories/notification-channel.repository';
import { SlackSender } from '../senders/slack.sender';
import { DiscordSender } from '../senders/discord.sender';
import { WebhookSender } from '../senders/webhook.sender';
import { EmailSender } from '../senders/email.sender';
import type { NotificationEvent } from '../interfaces';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly repository: NotificationChannelRepository,
    private readonly emailSender: EmailSender,
  ) {}

  async notify(orgId: string, event: NotificationEvent): Promise<void> {
    const channels = await this.repository.listEnabledByOrg(orgId);
    if (channels.length === 0) return;

    const results = await Promise.allSettled(
      channels.map((channel) => this.dispatch(channel, event)),
    );
    for (const result of results) {
      if (result.status === 'rejected') {
        this.logger.warn(`notification dispatch failed: ${result.reason}`);
      }
    }
  }

  private async dispatch(
    channel: NotificationChannel,
    event: NotificationEvent,
  ): Promise<void> {
    switch (channel.kind) {
      case 'slack':
        if (channel.webhookUrl) await SlackSender.send(channel.webhookUrl, event);
        return;
      case 'discord':
        if (channel.webhookUrl) await DiscordSender.send(channel.webhookUrl, event);
        return;
      case 'webhook':
        if (channel.webhookUrl) {
          await WebhookSender.send(channel.webhookUrl, channel.webhookSecret, event);
        }
        return;
      case 'email':
        await this.emailSender.send(channel, event);
        return;
    }
  }
}
