import { Module } from '@nestjs/common';
import { BackupsModule } from '../backups/backups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';

@Module({
  imports: [BackupsModule, NotificationsModule, AuditModule],
  exports: [BackupsModule, NotificationsModule, AuditModule],
})
export class OperationsModule {}
