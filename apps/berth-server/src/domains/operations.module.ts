import { Module } from '@nestjs/common';
import { BackupsModule } from '../backups/backups.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditModule } from '../audit/audit.module';
import { AdvisorModule } from '../advisor/advisor.module';

@Module({
  imports: [BackupsModule, NotificationsModule, AuditModule, AdvisorModule],
  exports: [BackupsModule, NotificationsModule, AuditModule],
})
export class OperationsModule {}
