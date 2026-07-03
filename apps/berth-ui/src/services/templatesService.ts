import { BaseApiClient } from '@/services/baseApiClient';
import type { Template } from '@/interfaces';

class TemplatesService extends BaseApiClient {
  protected resource = 'templates';

  list(): Promise<Template[]> {
    return this.get<Template[]>();
  }
}

export const templatesService = new TemplatesService();
