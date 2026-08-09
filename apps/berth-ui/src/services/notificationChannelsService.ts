import { BaseApiClient } from '@/services/baseApiClient';
import type { NotificationChannel, NotificationChannelKind } from '@/interfaces';

export interface CreateNotificationChannelPayload {
  name: string;
  kind: NotificationChannelKind;
  webhookUrl?: string;
  webhookSecret?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPassword?: string;
  emailFrom?: string;
  emailTo?: string;
}

class NotificationChannelsService extends BaseApiClient {
  protected resource = 'notification-channels';

  list(): Promise<NotificationChannel[]> {
    return this.get<NotificationChannel[]>('');
  }

  create(payload: CreateNotificationChannelPayload): Promise<NotificationChannel> {
    return this.post<NotificationChannel>('', payload);
  }

  setEnabled(id: string, enabled: boolean): Promise<{ ok: boolean }> {
    return this.patch<{ ok: boolean }>(`/${id}`, { enabled });
  }

  remove(id: string): Promise<void> {
    return this.delete<void>(`/${id}`);
  }
}

export const notificationChannelsService = new NotificationChannelsService();
