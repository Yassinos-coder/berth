import { BaseApiClient } from '@/services/baseApiClient';
import type { SystemVersion } from '@/interfaces';

class SystemService extends BaseApiClient {
  protected resource = 'system';

  version(): Promise<SystemVersion> {
    return this.get<SystemVersion>('/version');
  }

  update(): Promise<{ started: boolean }> {
    return this.post<{ started: boolean }>('/update');
  }
}

export const systemService = new SystemService();
