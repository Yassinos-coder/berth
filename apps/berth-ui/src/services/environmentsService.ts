import { BaseApiClient } from '@/services/baseApiClient';

export interface Environment {
  id: string;
  name: string;
  slug: string;
  isProduction: boolean;
  preview: boolean;
  _count: { services: number };
}

class EnvironmentsService extends BaseApiClient {
  protected resource = 'environments';

  list(): Promise<Environment[]> {
    return this.get<Environment[]>();
  }

  create(name: string, preview: boolean): Promise<Environment> {
    return this.post<Environment>('', {
      name,
      preview,
      isProduction: name.trim().toLowerCase() === 'production',
    });
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }

  assign(serviceId: string, environmentId: string | null): Promise<{ ok: boolean }> {
    return this.patch<{ ok: boolean }>(`/assign/${encodeURIComponent(serviceId)}`, { environmentId });
  }
}

export const environmentsService = new EnvironmentsService();
