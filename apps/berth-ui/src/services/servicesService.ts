import { BaseApiClient } from '@/services/baseApiClient';
import type { Connection, LogLine, MetricPoint, Service } from '@/interfaces';

export interface CreateServicePayload {
  name: string;
  kind: Service['kind'];
  serverId: string;
  resources: Service['resources'];
  source?: Service['source'];
  domain?: string;
  template?: string;
  publicNetworking?: boolean;
  env?: { key: string; value: string; isSecret?: boolean }[];
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'redeploy';

class ServicesService extends BaseApiClient {
  protected resource = 'services';

  list(): Promise<Service[]> {
    return this.get<Service[]>();
  }

  getById(id: string): Promise<Service> {
    return this.get<Service>(`/${id}`);
  }

  logs(id: string): Promise<LogLine[]> {
    return this.get<LogLine[]>(`/${id}/logs`);
  }

  metrics(id: string): Promise<MetricPoint[]> {
    return this.get<MetricPoint[]>(`/${id}/metrics`);
  }

  connection(id: string): Promise<Connection> {
    return this.get<Connection>(`/${id}/connection`);
  }

  create(payload: CreateServicePayload): Promise<Service> {
    return this.post<Service>('', payload);
  }

  setState(id: string, action: ServiceAction): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/${id}/${action}`);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const servicesService = new ServicesService();
