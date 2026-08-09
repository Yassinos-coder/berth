import { Injectable } from '@nestjs/common';
import type { LogLine, MetricPeak, MetricPoint } from '../../services/interfaces';

const MAX_LOGS = 500;
const MAX_METRICS = 120;
const PEAK_BUCKET_MS = 5 * 60_000;
const PEAK_WINDOW_MS = 24 * 60 * 60_000;
const PEAK_BUCKET_COUNT = PEAK_WINDOW_MS / PEAK_BUCKET_MS;

@Injectable()
export class TelemetryBuffer {
  private readonly logs = new Map<string, LogLine[]>();
  private readonly metrics = new Map<string, MetricPoint[]>();
  private readonly dailyPeaks = new Map<string, Map<number, MetricPeak>>();

  appendLog(serviceId: string, line: LogLine): void {
    const bucket = this.logs.get(serviceId) ?? [];
    bucket.push(line);
    if (bucket.length > MAX_LOGS) bucket.splice(0, bucket.length - MAX_LOGS);
    this.logs.set(serviceId, bucket);
  }

  appendMetric(serviceId: string, point: MetricPoint): void {
    const bucket = this.metrics.get(serviceId) ?? [];
    bucket.push(point);
    if (bucket.length > MAX_METRICS)
      bucket.splice(0, bucket.length - MAX_METRICS);
    this.metrics.set(serviceId, bucket);
    this.recordPeak(serviceId, point);
  }

  getLogs(serviceId: string): LogLine[] {
    return this.logs.get(serviceId) ?? [];
  }

  getMetrics(serviceId: string): MetricPoint[] {
    return this.metrics.get(serviceId) ?? [];
  }

  getDailyPeak(serviceId: string): MetricPeak {
    const buckets = this.dailyPeaks.get(serviceId);
    if (!buckets) return { cpuPct: 0, memMb: 0 };
    let cpuPct = 0;
    let memMb = 0;
    for (const bucket of buckets.values()) {
      cpuPct = Math.max(cpuPct, bucket.cpuPct);
      memMb = Math.max(memMb, bucket.memMb);
    }
    return { cpuPct, memMb };
  }

  clear(serviceId: string): void {
    this.logs.delete(serviceId);
    this.metrics.delete(serviceId);
    this.dailyPeaks.delete(serviceId);
  }

  private recordPeak(serviceId: string, point: MetricPoint): void {
    const buckets = this.dailyPeaks.get(serviceId) ?? new Map();
    const key = Math.floor(Date.now() / PEAK_BUCKET_MS);
    const existing = buckets.get(key);
    buckets.set(key, {
      cpuPct: Math.max(existing?.cpuPct ?? 0, point.cpuPct),
      memMb: Math.max(existing?.memMb ?? 0, point.memMb),
    });
    const cutoff = key - PEAK_BUCKET_COUNT;
    for (const bucketKey of buckets.keys()) {
      if (bucketKey < cutoff) buckets.delete(bucketKey);
    }
    this.dailyPeaks.set(serviceId, buckets);
  }
}
