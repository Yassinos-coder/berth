export interface MetricReading {
  ts: number;
  cpuPct: number;
  memMb: number;
  netRxMb: number;
  netTxMb: number;
}

export interface MetricAccumulator {
  count: number;
  cpuSum: number;
  memMax: number;
  netRxMb: number;
  netTxMb: number;
}

export interface MetricRangeSpec {
  rangeMs: number;
  bucketMs: number;
}

export type AlertKind = 'cpu' | 'memory';

export interface AlertWatch {
  cpuHighMinutes: number;
  memHighMinutes: number;
  lastAlertAt: Partial<Record<AlertKind, number>>;
}

export interface AlertLimits {
  cpuCores: number;
  memoryMb: number;
}

export interface AlertEvaluation {
  watch: AlertWatch;
  fired: AlertKind[];
}

export interface AlertThresholds {
  enabled: boolean;
  cpuPct: number;
  memPct: number;
  diskPct: number;
  minutes: number;
}

export interface EdgeSampleRow {
  ts: Date;
  requests: number;
  errors4xx: number;
  errors5xx: number;
  p95Ms: number;
}

export interface EdgeTrafficPoint {
  ts: number;
  requests: number;
  errors5xx: number;
}

export interface EdgeTrafficDto {
  hasTraffic: boolean;
  requests: number;
  errors4xx: number;
  errors5xx: number;
  errorRatePct: number;
  p95Ms: number;
  series: EdgeTrafficPoint[];
}

export interface EdgeOwner {
  serviceId: string;
  serviceName: string;
  orgId: string;
}
