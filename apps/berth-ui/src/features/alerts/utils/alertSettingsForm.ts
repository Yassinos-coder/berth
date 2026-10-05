import type { AlertSettings } from '@/services/alertSettingsService';

export interface AlertSettingsDraft {
  enabled: boolean;
  cpuPct: string;
  memPct: string;
  diskPct: string;
  minutes: string;
}

export type AlertSettingsErrors = Partial<Record<'cpuPct' | 'memPct' | 'diskPct' | 'minutes', string>>;

const LIMITS = {
  cpuPct: { min: 50, max: 100, label: 'CPU' },
  memPct: { min: 50, max: 100, label: 'Memory' },
  diskPct: { min: 50, max: 99, label: 'Disk' },
  minutes: { min: 1, max: 60, label: 'Duration' },
} as const;

export class AlertSettingsForm {
  static toDraft(settings: AlertSettings): AlertSettingsDraft {
    return {
      enabled: settings.enabled,
      cpuPct: String(settings.cpuPct),
      memPct: String(settings.memPct),
      diskPct: String(settings.diskPct),
      minutes: String(settings.minutes),
    };
  }

  static validate(draft: AlertSettingsDraft): AlertSettingsErrors {
    const errors: AlertSettingsErrors = {};
    for (const field of Object.keys(LIMITS) as (keyof typeof LIMITS)[]) {
      const { min, max, label } = LIMITS[field];
      const value = Number(draft[field]);
      if (draft[field].trim() === '' || !Number.isInteger(value) || value < min || value > max) {
        errors[field] = `${label} must be a whole number from ${min} to ${max}.`;
      }
    }
    return errors;
  }

  static toPayload(draft: AlertSettingsDraft): AlertSettings {
    return {
      enabled: draft.enabled,
      cpuPct: Number(draft.cpuPct),
      memPct: Number(draft.memPct),
      diskPct: Number(draft.diskPct),
      minutes: Number(draft.minutes),
    };
  }

  static isDirty(draft: AlertSettingsDraft, saved: AlertSettings): boolean {
    const current = this.toDraft(saved);
    return (Object.keys(current) as (keyof AlertSettingsDraft)[]).some((key) => current[key] !== draft[key]);
  }
}
