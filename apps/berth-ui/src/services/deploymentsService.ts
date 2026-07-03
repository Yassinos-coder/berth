import { BaseApiClient } from '@/services/baseApiClient';
import type { Deployment } from '@/interfaces';

class DeploymentsService extends BaseApiClient {
  protected resource = 'deployments';

  list(): Promise<Deployment[]> {
    return this.get<Deployment[]>();
  }

  listForService(serviceId: string): Promise<Deployment[]> {
    return this.get<Deployment[]>(`?serviceId=${serviceId}`);
  }

  rollback(deploymentId: string): Promise<{ ok: boolean }> {
    return this.post<{ ok: boolean }>(`/${deploymentId}/rollback`);
  }
}

export const deploymentsService = new DeploymentsService();
