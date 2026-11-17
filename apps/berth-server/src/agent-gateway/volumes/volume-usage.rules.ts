export const VOLUME_ALERT_PCT = 90;
export const VOLUME_ALERT_COOLDOWN_MS = 6 * 60 * 60_000;

export class VolumeUsageRules {
  static percent(usedMb: number, totalMb: number): number {
    if (totalMb <= 0) return 0;
    return Math.min(100, Math.round((usedMb / totalMb) * 100));
  }

  static shouldAlert(percent: number, lastAlertAt: number | undefined, now: number): boolean {
    if (percent < VOLUME_ALERT_PCT) return false;
    return lastAlertAt === undefined || now - lastAlertAt >= VOLUME_ALERT_COOLDOWN_MS;
  }

  static candidateNames(reported: string): string[] {
    const legacy = reported.endsWith('-sized') ? reported.slice(0, -'-sized'.length) : null;
    return legacy ? [reported, legacy] : [reported];
  }

  static sane(entry: { name: unknown; usedMb: unknown; totalMb: unknown }): boolean {
    return (
      typeof entry.name === 'string' &&
      entry.name.length > 0 &&
      entry.name.length <= 128 &&
      Number.isFinite(entry.usedMb) &&
      Number.isFinite(entry.totalMb) &&
      (entry.usedMb as number) >= 0 &&
      (entry.totalMb as number) > 0
    );
  }
}
