import { BaseApiClient } from '@/services/baseApiClient';
import type { RegistryImage, RegistryTag } from '@/interfaces';

class RegistryService extends BaseApiClient {
  protected resource = 'registry';

  search(query: string): Promise<RegistryImage[]> {
    return this.get<RegistryImage[]>(`/search?q=${encodeURIComponent(query)}`);
  }

  tags(image: string): Promise<RegistryTag[]> {
    return this.get<RegistryTag[]>(`/tags?image=${encodeURIComponent(image)}`);
  }
}

export const registryService = new RegistryService();
