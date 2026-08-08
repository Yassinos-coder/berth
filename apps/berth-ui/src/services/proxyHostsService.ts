import { BaseApiClient } from '@/services/baseApiClient';
import type { ProxyHost } from '@/interfaces';

export interface CreateProxyHostPayload {
  domain: string;
  serviceId: string;
  targetPort: number;
  ssl?: boolean;
  forceHttps?: boolean;
}

export interface UpdateProxyHostPayload {
  domain?: string;
  targetPort?: number;
  ssl?: boolean;
  forceHttps?: boolean;
}

class ProxyHostsService extends BaseApiClient {
  protected resource = 'proxy-hosts';

  list(): Promise<ProxyHost[]> {
    return this.get<ProxyHost[]>();
  }

  create(payload: CreateProxyHostPayload): Promise<ProxyHost> {
    return this.post<ProxyHost>('', payload);
  }

  update(id: string, payload: UpdateProxyHostPayload): Promise<ProxyHost> {
    return this.patch<ProxyHost>(`/${id}`, payload);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const proxyHostsService = new ProxyHostsService();
