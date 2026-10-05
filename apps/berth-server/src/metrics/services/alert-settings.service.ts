import { Injectable } from '@nestjs/common';
import { MetricSampleRepository } from '../repositories/metric-sample.repository';
import type { AlertThresholds } from '../interfaces';
import type { UpdateAlertSettingsDto } from '../dto/update-alert-settings.dto';

@Injectable()
export class AlertSettingsService {
  constructor(private readonly repository: MetricSampleRepository) {}

  get(orgId: string): Promise<AlertThresholds> {
    return this.repository.alertThresholds(orgId);
  }

  update(orgId: string, dto: UpdateAlertSettingsDto): Promise<AlertThresholds> {
    return this.repository.updateAlertThresholds(orgId, dto);
  }
}
