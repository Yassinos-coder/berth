import type { AlertEvaluation, AlertLimits, AlertWatch, MetricReading } from '../interfaces';

const HIGH_WATERMARK = 0.9;
const SUSTAINED_MINUTES = 5;
const ALERT_COOLDOWN_MS = 60 * 60_000;

export class MetricAlertRulesUtil {
  static emptyWatch(): AlertWatch {
    return { cpuHighMinutes: 0, memHighMinutes: 0, lastAlertAt: {} };
  }

  static evaluate(
    watch: AlertWatch,
    reading: Pick<MetricReading, 'cpuPct' | 'memMb'>,
    limits: AlertLimits,
    now: number,
  ): AlertEvaluation {
    const cpuRatio = reading.cpuPct / Math.max(limits.cpuCores * 100, 1);
    const memRatio = reading.memMb / Math.max(limits.memoryMb, 1);

    const next: AlertWatch = {
      cpuHighMinutes: cpuRatio >= HIGH_WATERMARK ? watch.cpuHighMinutes + 1 : 0,
      memHighMinutes: memRatio >= HIGH_WATERMARK ? watch.memHighMinutes + 1 : 0,
      lastAlertAt: { ...watch.lastAlertAt },
    };

    const fired: AlertEvaluation['fired'] = [];
    if (next.cpuHighMinutes >= SUSTAINED_MINUTES && this.cooledDown(next, 'cpu', now)) {
      fired.push('cpu');
      next.lastAlertAt.cpu = now;
    }
    if (next.memHighMinutes >= SUSTAINED_MINUTES && this.cooledDown(next, 'memory', now)) {
      fired.push('memory');
      next.lastAlertAt.memory = now;
    }
    return { watch: next, fired };
  }

  static diskHigh(usedGb: number, totalGb: number): boolean {
    return totalGb > 0 && usedGb / totalGb >= HIGH_WATERMARK;
  }

  private static cooledDown(watch: AlertWatch, kind: 'cpu' | 'memory', now: number): boolean {
    const last = watch.lastAlertAt[kind];
    return last === undefined || now - last >= ALERT_COOLDOWN_MS;
  }
}
