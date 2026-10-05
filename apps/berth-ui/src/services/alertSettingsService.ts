import { BaseApiClient } from '@/services/baseApiClient';

export interface AlertSettings {
  enabled: boolean;
  cpuPct: number;
  memPct: number;
  diskPct: number;
  minutes: number;
}

class AlertSettingsService extends BaseApiClient {
  protected resource = 'alert-settings';

  current(): Promise<AlertSettings> {
    return this.get<AlertSettings>();
  }

  update(settings: Partial<AlertSettings>): Promise<AlertSettings> {
    return this.patch<AlertSettings>('', settings);
  }
}

export const alertSettingsService = new AlertSettingsService();
