import type { Server } from '@/interfaces';

export class ServiceMoveRules {
  static targets(servers: Server[], currentServerId: string): Server[] {
    return servers.filter((server) => server.id !== currentServerId && server.status === 'online');
  }

  static warnings(hasFiles: boolean, hasDomains: boolean): string[] {
    const notes: string[] = [];
    if (hasFiles) notes.push('Its stored files stay on the current server. The new copy starts empty.');
    if (hasDomains) notes.push("Its domains must be pointed at the new server's IP address.");
    notes.push('It is stopped on the current server and started on the new one, so expect a short interruption.');
    return notes;
  }
}
