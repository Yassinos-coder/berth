import { BaseApiClient } from '@/services/baseApiClient';
import type { Enrollment, Server } from '@/interfaces';

class ServersService extends BaseApiClient {
  protected resource = 'servers';

  list(): Promise<Server[]> {
    return this.get<Server[]>();
  }

  getById(id: string): Promise<Server> {
    return this.get<Server>(`/${id}`);
  }

  enroll(name: string): Promise<Enrollment> {
    return this.post<Enrollment>('/enroll', { name });
  }

  reenroll(id: string): Promise<Enrollment> {
    return this.post<Enrollment>(`/${id}/reenroll`, {});
  }

  updateStorage(id: string, storageBudgetGb: number): Promise<Server> {
    return this.patch<Server>(`/${id}/storage`, { storageBudgetGb });
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const serversService = new ServersService();
