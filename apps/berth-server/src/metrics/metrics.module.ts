import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { AlertSettingsController } from './controllers/alert-settings.controller';
import { MetricsHistoryController } from './controllers/metrics-history.controller';
import { EdgeTrafficController } from './controllers/edge-traffic.controller';
import { EdgeSampleRepository } from './repositories/edge-sample.repository';
import { EdgeTrafficService } from './services/edge-traffic.service';
import { MetricSampleRepository } from './repositories/metric-sample.repository';
import { AlertSettingsService } from './services/alert-settings.service';
import { MetricsHistoryService } from './services/metrics-history.service';
import { MetricsRecorderService } from './services/metrics-recorder.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MetricsHistoryController, AlertSettingsController, EdgeTrafficController],
  providers: [EdgeSampleRepository, EdgeTrafficService, MetricSampleRepository, MetricsHistoryService, MetricsRecorderService, AlertSettingsService],
  exports: [MetricsRecorderService, EdgeTrafficService],
})
export class MetricsModule {}
