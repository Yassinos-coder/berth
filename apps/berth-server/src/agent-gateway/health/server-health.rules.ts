export const OFFLINE_GRACE_MS = 2 * 60_000;

export interface ServerHealthSubject {
  status: string;
  lastSeenAt: Date;
  offlineAlertedAt: Date | null;
}

export class ServerHealthRules {
  static dueForOfflineAlert(server: ServerHealthSubject, now: number): boolean {
    if (server.status !== 'offline' || server.offlineAlertedAt) return false;
    return now - server.lastSeenAt.getTime() >= OFFLINE_GRACE_MS;
  }

  static offlineFor(server: Pick<ServerHealthSubject, 'lastSeenAt'>, now: number): string {
    const minutes = Math.max(1, Math.round((now - server.lastSeenAt.getTime()) / 60_000));
    if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
    const hours = Math.round(minutes / 60);
    return `${hours} hour${hours === 1 ? '' : 's'}`;
  }
}
