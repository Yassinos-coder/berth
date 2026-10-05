import { BaseApiClient } from '@/services/baseApiClient';
import type { ProxyHost } from '@/interfaces';

export interface CreateProxyHostPayload {
  domain: string;
  path?: string;
  serviceId: string;
  targetPort: number;
  ssl?: boolean;
  forceHttps?: boolean;
}

export interface UpdateProxyHostPayload {
  domain?: string;
  path?: string;
  targetPort?: number;
  ssl?: boolean;
  forceHttps?: boolean;
}

export type DnsCheckStatus = 'ok' | 'mismatch' | 'unresolved' | 'unknown';

export interface DnsCheck {
  status: DnsCheckStatus;
  domain: string;
  expectedIp?: string;
  resolved: string[];
  message: string;
}

class ProxyHostsService extends BaseApiClient {
  protected resource = 'proxy-hosts';

  list(): Promise<ProxyHost[]> {
    return this.get<ProxyHost[]>();
  }

  dnsCheck(domain: string, serviceId: string): Promise<DnsCheck> {
    return this.get<DnsCheck>(
      `/dns-check?domain=${encodeURIComponent(domain)}&serviceId=${encodeURIComponent(serviceId)}`,
    );
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
