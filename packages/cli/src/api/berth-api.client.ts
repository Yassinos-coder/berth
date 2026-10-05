import type {
  BerthConfig,
  DeploymentSummary,
  EnvEntry,
  LogLine,
  ServiceAction,
  ServiceSummary,
} from '@/interfaces';
import { ServiceResolverUtil } from '@/utils/service-resolver.util';

const REQUEST_TIMEOUT_MS = 30_000;

export class BerthApiClient {
  constructor(private readonly config: BerthConfig) {}

  listServices(): Promise<ServiceSummary[]> {
    return this.request<ServiceSummary[]>('GET', '/services');
  }

  async findService(reference: string): Promise<ServiceSummary> {
    return ServiceResolverUtil.resolve(await this.listServices(), reference);
  }

  serviceAction(id: string, action: ServiceAction): Promise<unknown> {
    return this.request('POST', `/services/${encodeURIComponent(id)}/${action}`);
  }

  logs(id: string): Promise<LogLine[]> {
    return this.request<LogLine[]>('GET', `/services/${encodeURIComponent(id)}/logs`);
  }

  deployments(serviceId?: string): Promise<DeploymentSummary[]> {
    const query = serviceId ? `?serviceId=${encodeURIComponent(serviceId)}` : '';
    return this.request<DeploymentSummary[]>('GET', `/deployments${query}`);
  }

  rollback(deploymentId: string): Promise<{ ok: boolean }> {
    return this.request('POST', `/deployments/${encodeURIComponent(deploymentId)}/rollback`);
  }

  env(id: string): Promise<EnvEntry[]> {
    return this.request<EnvEntry[]>('GET', `/services/${encodeURIComponent(id)}/env`);
  }

  setEnv(id: string, env: EnvEntry[]): Promise<EnvEntry[]> {
    return this.request<EnvEntry[]>('PUT', `/services/${encodeURIComponent(id)}/env`, { env });
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const response = await fetch(`${this.config.url}/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.config.token}`,
        'X-Berth-Client': 'cli',
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }).catch((error: Error) => {
      throw new Error(`Could not reach ${this.config.url}: ${error.message}`);
    });

    if (!response.ok) throw new Error(await this.describeFailure(response));
    const text = await response.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  private async describeFailure(response: Response): Promise<string> {
    const text = await response.text().catch(() => '');
    let message = text;
    try {
      const parsed = JSON.parse(text) as { message?: string | string[] };
      message = Array.isArray(parsed.message) ? parsed.message.join(', ') : (parsed.message ?? text);
    } catch {
      message = text;
    }
    if (response.status === 401) return `Unauthorized: ${message || 'check your API token'}`;
    if (response.status === 403) return `Forbidden: ${message || 'your token role cannot do this'}`;
    return `${response.status} ${response.statusText}${message ? `: ${message}` : ''}`;
  }
}
