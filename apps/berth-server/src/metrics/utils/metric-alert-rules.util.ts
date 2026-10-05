import type {
  AlertEvaluation,
  AlertLimits,
  AlertThresholds,
  AlertWatch,
  MetricReading,
} from '../interfaces';

export const DEFAULT_ALERT_THRESHOLDS: AlertThresholds = {
  enabled: true,
  cpuPct: 90,
  memPct: 90,
  diskPct: 90,
  minutes: 5,
};

const ALERT_COOLDOWN_MS = 60 * 60_000;

export class MetricAlertRulesUtil {
  static emptyWatch(): AlertWatch {
    return { cpuHighMinutes: 0, memHighMinutes: 0, lastAlertAt: {} };
  }

  static evaluate(
    watch: AlertWatch,
    reading: Pick<MetricReading, 'cpuPct' | 'memMb'>,
    limits: AlertLimits,
    thresholds: AlertThresholds,
    now: number,
  ): AlertEvaluation {
    const cpuRatio = reading.cpuPct / Math.max(limits.cpuCores * 100, 1);
    const memRatio = reading.memMb / Math.max(limits.memoryMb, 1);

    const next: AlertWatch = {
      cpuHighMinutes: cpuRatio >= thresholds.cpuPct / 100 ? watch.cpuHighMinutes + 1 : 0,
      memHighMinutes: memRatio >= thresholds.memPct / 100 ? watch.memHighMinutes + 1 : 0,
      lastAlertAt: { ...watch.lastAlertAt },
    };

    const fired: AlertEvaluation['fired'] = [];
    if (next.cpuHighMinutes >= thresholds.minutes && this.cooledDown(next, 'cpu', now)) {
      fired.push('cpu');
      next.lastAlertAt.cpu = now;
    }
    if (next.memHighMinutes >= thresholds.minutes && this.cooledDown(next, 'memory', now)) {
      fired.push('memory');
      next.lastAlertAt.memory = now;
    }
    return { watch: next, fired };
  }

  static diskHigh(usedGb: number, totalGb: number, thresholdPct: number): boolean {
    return totalGb > 0 && usedGb / totalGb >= thresholdPct / 100;
  }

  private static cooledDown(watch: AlertWatch, kind: 'cpu' | 'memory', now: number): boolean {
    const last = watch.lastAlertAt[kind];
    return last === undefined || now - last >= ALERT_COOLDOWN_MS;
  }
}
