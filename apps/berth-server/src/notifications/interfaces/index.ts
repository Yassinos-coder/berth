export type NotificationChannelKind = 'slack' | 'discord' | 'webhook' | 'email';

export interface NotificationChannelDto {
  id: string;
  name: string;
  kind: NotificationChannelKind;
  enabled: boolean;
  webhookUrl?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpUser?: string;
  emailFrom?: string;
  emailTo?: string;
  createdAt: string;
}

export type NotificationSeverity = 'info' | 'warning' | 'error';

export interface NotificationEvent {
  type?: 'deployment.succeeded' | 'deployment.failed' | 'service.crashed' | 'backup.failed' | 'restore.completed' | 'restore.failed';
  title: string;
  detail: string;
  severity: NotificationSeverity;
}
