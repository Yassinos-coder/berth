import type { EdgeSampleRow } from '../interfaces';

export const EDGE_ALERT_WINDOW_MS = 5 * 60_000;
export const EDGE_ALERT_MIN_REQUESTS = 20;
export const EDGE_ALERT_ERROR_RATE = 0.05;
export const EDGE_ALERT_COOLDOWN_MS = 60 * 60_000;

export class EdgeAlertRulesUtil {
  static errorRate(samples: Pick<EdgeSampleRow, 'requests' | 'errors5xx'>[]): { requests: number; rate: number } {
    const requests = samples.reduce((sum, sample) => sum + sample.requests, 0);
    const errors = samples.reduce((sum, sample) => sum + sample.errors5xx, 0);
    return { requests, rate: requests === 0 ? 0 : errors / requests };
  }

  static shouldAlert(
    recent: Pick<EdgeSampleRow, 'requests' | 'errors5xx'>[],
    lastAlertAt: number | undefined,
    now: number,
  ): boolean {
    const { requests, rate } = EdgeAlertRulesUtil.errorRate(recent);
    if (requests < EDGE_ALERT_MIN_REQUESTS || rate < EDGE_ALERT_ERROR_RATE) return false;
    return lastAlertAt === undefined || now - lastAlertAt >= EDGE_ALERT_COOLDOWN_MS;
  }

  static primaryOwner<T extends { path: string }>(hosts: T[]): T | undefined {
    return hosts.find((host) => host.path === '/') ?? hosts[0];
  }

  static weightedP95(samples: Pick<EdgeSampleRow, 'requests' | 'p95Ms'>[]): number {
    const requests = samples.reduce((sum, sample) => sum + sample.requests, 0);
    if (requests === 0) return 0;
    const weighted = samples.reduce((sum, sample) => sum + sample.p95Ms * sample.requests, 0);
    return Math.round(weighted / requests);
  }
}
