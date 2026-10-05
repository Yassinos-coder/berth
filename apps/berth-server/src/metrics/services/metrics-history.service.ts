import { Injectable } from '@nestjs/common';
import { MetricSampleRepository } from '../repositories/metric-sample.repository';
import type { MetricReading } from '../interfaces';
import { MetricDownsamplerUtil } from '../utils/metric-downsampler.util';
import { MetricRangeValidator } from '../validators/metric-range.validator';

@Injectable()
export class MetricsHistoryService {
  constructor(private readonly repository: MetricSampleRepository) {}

  async history(orgId: string, serviceId: string, range?: string): Promise<MetricReading[]> {
    const spec = MetricRangeValidator.resolve(range);
    const samples = await this.repository.history(
      orgId,
      serviceId,
      new Date(Date.now() - spec.rangeMs),
    );
    return MetricDownsamplerUtil.bucket(samples, spec.bucketMs);
  }
}
