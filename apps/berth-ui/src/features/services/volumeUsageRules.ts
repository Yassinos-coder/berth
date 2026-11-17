export type UsageLevel = 'ok' | 'warning' | 'critical';

export class VolumeUsageRules {
  static percent(usedMb: number, totalMb: number): number {
    if (totalMb <= 0) return 0;
    return Math.min(100, Math.round((usedMb / totalMb) * 100));
  }

  static level(percent: number): UsageLevel {
    if (percent >= 90) return 'critical';
    if (percent >= 80) return 'warning';
    return 'ok';
  }

  static format(mb: number): string {
    if (mb >= 1024) return `${(mb / 1024).toFixed(mb >= 10 * 1024 ? 0 : 1)} GB`;
    return `${Math.round(mb)} MB`;
  }

  static stale(at: string, now = Date.now()): boolean {
    return now - new Date(at).getTime() > 10 * 60_000;
  }
}
