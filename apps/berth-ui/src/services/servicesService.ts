import { BaseApiClient } from '@/services/baseApiClient';
import type {
  Connection,
  LogLine,
  MetricPeak,
  MetricPoint,
  Service,
} from '@/interfaces';
import type { EnvVar } from '@berth/protocol';

export interface CreateServicePayload {
  name: string;
  kind: Service['kind'];
  serverId: string;
  resources: Service['resources'];
  source?: Service['source'];
  domain?: string;
  template?: string;
  username?: string;
  password?: string;
  diskGb?: number;
  publicNetworking?: boolean;
  env?: { key: string; value: string; isSecret?: boolean }[];
}

export interface UpdateServicePayload {
  name?: string;
  rootDirectory?: string;
  buildCommand?: string;
  startCommand?: string;
  dockerfilePath?: string;
  builder?: 'auto' | 'nixpacks' | 'dockerfile';
  registryCredentialId?: string;
  targetPlatform?: 'linux/amd64' | 'linux/arm64';
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

  metricsPeak(id: string): Promise<MetricPeak> {
    return this.get<MetricPeak>(`/${id}/metrics/peak`);
  }

  connection(id: string): Promise<Connection> {
    return this.get<Connection>(`/${id}/connection`);
  }

  create(payload: CreateServicePayload): Promise<Service> {
    return this.post<Service>('', payload);
  }

  update(id: string, payload: UpdateServicePayload): Promise<Service> {
    return this.patch<Service>(`/${id}`, payload);
  }

  addInternalDomain(id: string): Promise<Service> {
    return this.post<Service>(`/${id}/internal-domains`, {});
  }

  removeInternalDomain(id: string, domain: string): Promise<Service> {
    return this.delete<Service>(
      `/${id}/internal-domains/${encodeURIComponent(domain)}`,
    );
  }

  getEnv(id: string): Promise<EnvVar[]> {
    return this.get<EnvVar[]>(`/${id}/env`);
  }

  setEnv(id: string, env: EnvVar[]): Promise<EnvVar[]> {
    return this.put<EnvVar[]>(`/${id}/env`, { env });
  }

  setState(id: string, action: ServiceAction): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/${id}/${action}`);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const servicesService = new ServicesService();
