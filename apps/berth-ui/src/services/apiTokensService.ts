import { BaseApiClient } from '@/services/baseApiClient';
import type { ApiToken, CreatedApiToken } from '@/interfaces';

export interface CreateApiTokenPayload {
  name: string;
  expiresInDays?: number;
}

class ApiTokensService extends BaseApiClient {
  protected resource = 'api-tokens';

  list(): Promise<ApiToken[]> {
    return this.get<ApiToken[]>('');
  }

  create(payload: CreateApiTokenPayload): Promise<CreatedApiToken> {
    return this.post<CreatedApiToken>('', payload);
  }

  revoke(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const apiTokensService = new ApiTokensService();
