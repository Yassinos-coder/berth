import { Module } from '@nestjs/common';
import { NotificationChannelsController } from './controllers/notification-channels.controller';
import { NotificationChannelsService } from './services/notification-channels.service';
import { NotificationsService } from './services/notifications.service';
import { NotificationChannelRepository } from './repositories/notification-channel.repository';
import { EmailSender } from './senders/email.sender';

@Module({
  controllers: [NotificationChannelsController],
  providers: [
    NotificationChannelsService,
    NotificationsService,
    NotificationChannelRepository,
    EmailSender,
  ],
  exports: [NotificationsService],
})
export class NotificationsModule {}
