import type { AlertThresholds } from '../interfaces';

interface OrgAlertFields {
  alertsEnabled: boolean;
  alertCpuPct: number;
  alertMemPct: number;
  alertDiskPct: number;
  alertMinutes: number;
}

export const ORG_ALERT_SELECT = {
  alertsEnabled: true,
  alertCpuPct: true,
  alertMemPct: true,
  alertDiskPct: true,
  alertMinutes: true,
} as const;

export class AlertThresholdMapper {
  static fromOrg(org: OrgAlertFields): AlertThresholds {
    return {
      enabled: org.alertsEnabled,
      cpuPct: org.alertCpuPct,
      memPct: org.alertMemPct,
      diskPct: org.alertDiskPct,
      minutes: org.alertMinutes,
    };
  }

  static toOrgData(input: Partial<AlertThresholds>) {
    return {
      alertsEnabled: input.enabled,
      alertCpuPct: input.cpuPct,
      alertMemPct: input.memPct,
      alertDiskPct: input.diskPct,
      alertMinutes: input.minutes,
    };
  }
}
