import type { MetricRangeSpec } from '../interfaces';

const HOUR_MS = 60 * 60_000;
const MINUTE_MS = 60_000;

const RANGES: Record<string, MetricRangeSpec> = {
  '1h': { rangeMs: HOUR_MS, bucketMs: MINUTE_MS },
  '24h': { rangeMs: 24 * HOUR_MS, bucketMs: 10 * MINUTE_MS },
  '7d': { rangeMs: 7 * 24 * HOUR_MS, bucketMs: HOUR_MS },
};

export const METRIC_RETENTION_MS = 7 * 24 * HOUR_MS;

export class MetricRangeValidator {
  static resolve(range: string | undefined): MetricRangeSpec {
    return (range && Object.prototype.hasOwnProperty.call(RANGES, range) ? RANGES[range] : RANGES['24h']);
  }
}
