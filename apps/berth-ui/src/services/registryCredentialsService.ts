import { BaseApiClient } from '@/services/baseApiClient';
import type { RegistryCredential } from '@/interfaces';

export interface CreateRegistryCredentialPayload {
  name: string;
  server?: string;
  username: string;
  password: string;
}

class RegistryCredentialsService extends BaseApiClient {
  protected resource = 'registry-credentials';

  list(): Promise<RegistryCredential[]> {
    return this.get<RegistryCredential[]>('');
  }

  create(payload: CreateRegistryCredentialPayload): Promise<RegistryCredential> {
    return this.post<RegistryCredential>('', payload);
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const registryCredentialsService = new RegistryCredentialsService();
