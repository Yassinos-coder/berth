export interface MoveSubject {
  serverId: string;
  volumePath: string | null;
  previewOfId: string | null;
}

export interface MoveTarget {
  id: string;
  status: string;
}

export class ServiceMoveValidator {
  static conflict(
    service: MoveSubject,
    target: MoveTarget | null,
    confirmDataLoss: boolean,
  ): string | null {
    if (!target) return 'Target server not found';
    if (service.previewOfId) return 'Preview environments cannot be moved. Move the service they belong to instead.';
    if (target.id === service.serverId) return 'This service already runs on that server.';
    if (target.status !== 'online') return 'The target server is offline. Choose a server that is online.';
    if (service.volumePath && !confirmDataLoss) {
      return 'This service stores files on its current server and they do not move with it. The new copy would start empty. Confirm that you accept this, or back up first.';
    }
    return null;
  }
}
