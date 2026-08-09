import { createHmac } from 'node:crypto';
import type { NotificationEvent } from '../interfaces';

export class WebhookSender {
  static async send(
    url: string,
    secret: string | undefined | null,
    event: NotificationEvent,
  ): Promise<void> {
    const payload = JSON.stringify({ ...event, timestamp: Date.now() });
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'X-Berth-Event': event.type ?? 'notification',
    };
    if (secret) {
      headers['X-Berth-Signature'] =
        `sha256=${createHmac('sha256', secret).update(payload).digest('hex')}`;
    }

    const res = await fetch(url, { method: 'POST', headers, body: payload });
    if (!res.ok) {
      throw new Error(`Webhook responded with ${res.status}`);
    }
  }
}
