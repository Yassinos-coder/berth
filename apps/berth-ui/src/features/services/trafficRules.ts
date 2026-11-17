export type TrafficHealth = 'ok' | 'warning' | 'critical';

export class TrafficRules {
  static health(errorRatePct: number, requests: number): TrafficHealth {
    if (requests < 20) return 'ok';
    if (errorRatePct >= 5) return 'critical';
    if (errorRatePct >= 1) return 'warning';
    return 'ok';
  }

  static count(value: number): string {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
    if (value >= 10_000) return `${Math.round(value / 1000)}k`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    return String(value);
  }

  static latency(ms: number): string {
    return ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${ms} ms`;
  }
}
