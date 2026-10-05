import { Module } from '@nestjs/common';
import { NotificationsModule } from '../notifications/notifications.module';
import { MetricsHistoryController } from './controllers/metrics-history.controller';
import { MetricSampleRepository } from './repositories/metric-sample.repository';
import { MetricsHistoryService } from './services/metrics-history.service';
import { MetricsRecorderService } from './services/metrics-recorder.service';

@Module({
  imports: [NotificationsModule],
  controllers: [MetricsHistoryController],
  providers: [MetricSampleRepository, MetricsHistoryService, MetricsRecorderService],
  exports: [MetricsRecorderService],
})
export class MetricsModule {}
