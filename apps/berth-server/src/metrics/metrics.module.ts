import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertSettingsController } from './controllers/alert-settings.controller';
import { MetricsHistoryController } from './controllers/metrics-history.controller';
import { MetricSampleRepository } from './repositories/metric-sample.repository';
import { AlertSettingsService } from './services/alert-settings.service';
import { MetricsHistoryService } from './services/metrics-history.service';
import { MetricsRecorderService } from './services/metrics-recorder.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MetricsHistoryController, AlertSettingsController],
  providers: [MetricSampleRepository, MetricsHistoryService, MetricsRecorderService, AlertSettingsService],
  exports: [MetricsRecorderService],
})
export class MetricsModule {}
