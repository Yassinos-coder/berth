import type { NotificationEvent } from '../interfaces';

export class DiscordSender {
  static async send(webhookUrl: string, event: NotificationEvent): Promise<void> {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: `**${event.title}**\n${event.detail}` }),
    });
    if (!res.ok) {
      throw new Error(`Discord webhook responded with ${res.status}`);
    }
  }
}
