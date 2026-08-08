import { BaseApiClient } from '@/services/baseApiClient';
import type {
  PanelDomainSettings,
  ResourceSettings,
  SystemVersion,
} from '@/interfaces';

class SystemService extends BaseApiClient {
  protected resource = 'system';

  version(): Promise<SystemVersion> {
    return this.get<SystemVersion>('/version');
  }

  update(): Promise<{ started: boolean }> {
    return this.post<{ started: boolean }>('/update');
  }

  resourceSettings(): Promise<ResourceSettings> {
    return this.get<ResourceSettings>('/resource-settings');
  }

  updateResourceSettings(enabled: boolean): Promise<ResourceSettings> {
    return this.patch<ResourceSettings>('/resource-settings', { enabled });
  }

  panelDomain(): Promise<PanelDomainSettings> {
    return this.get<PanelDomainSettings>('/panel-domain');
  }

  updatePanelDomain(domain: string): Promise<PanelDomainSettings> {
    return this.patch<PanelDomainSettings>('/panel-domain', { domain });
  }
}

export const systemService = new SystemService();
