import type { EdgeSampleRow, EdgeTrafficDto } from '../interfaces';
import { EdgeAlertRulesUtil } from './edge-alert-rules.util';

export class EdgeTrafficBucketerUtil {
  static summarise(samples: EdgeSampleRow[], bucketMs: number): EdgeTrafficDto {
    const requests = samples.reduce((sum, sample) => sum + sample.requests, 0);
    const errors4xx = samples.reduce((sum, sample) => sum + sample.errors4xx, 0);
    const errors5xx = samples.reduce((sum, sample) => sum + sample.errors5xx, 0);

    const buckets = new Map<number, { requests: number; errors5xx: number }>();
    for (const sample of samples) {
      const key = Math.floor(sample.ts.getTime() / bucketMs) * bucketMs;
      const bucket = buckets.get(key) ?? { requests: 0, errors5xx: 0 };
      bucket.requests += sample.requests;
      bucket.errors5xx += sample.errors5xx;
      buckets.set(key, bucket);
    }

    return {
      hasTraffic: requests > 0,
      requests,
      errors4xx,
      errors5xx,
      errorRatePct: requests === 0 ? 0 : Math.round((errors5xx / requests) * 1000) / 10,
      p95Ms: EdgeAlertRulesUtil.weightedP95(samples),
      series: [...buckets.entries()]
        .sort((left, right) => left[0] - right[0])
        .map(([ts, bucket]) => ({ ts, ...bucket })),
    };
  }
}
