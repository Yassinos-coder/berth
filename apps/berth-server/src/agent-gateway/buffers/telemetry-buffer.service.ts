import { Injectable } from '@nestjs/common';
import type { LogLine, MetricPoint } from '../../services/interfaces';

const MAX_LOGS = 500;
const MAX_METRICS = 120;

@Injectable()
export class TelemetryBuffer {
  private readonly logs = new Map<string, LogLine[]>();
  private readonly metrics = new Map<string, MetricPoint[]>();

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
  }

  getLogs(serviceId: string): LogLine[] {
    return this.logs.get(serviceId) ?? [];
  }

  getMetrics(serviceId: string): MetricPoint[] {
    return this.metrics.get(serviceId) ?? [];
  }

  clear(serviceId: string): void {
    this.logs.delete(serviceId);
    this.metrics.delete(serviceId);
  }
}
