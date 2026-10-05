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
