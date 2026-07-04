import { Injectable, Logger } from '@nestjs/common';
import type { WebSocket } from 'ws';
import type { PanelToAgent } from '@berth/protocol';
import { ReconcilePlanner } from '../reconcile/reconcile-planner.service';
import { ReconcileRepository } from '../reconcile/reconcile.repository';

@Injectable()
export class AgentRegistry {
  private readonly logger = new Logger(AgentRegistry.name);
  private readonly sockets = new Map<string, WebSocket>();

  constructor(
    private readonly planner: ReconcilePlanner,
    private readonly repository: ReconcileRepository,
  ) {}

  register(serverId: string, socket: WebSocket): void {
    const existing = this.sockets.get(serverId);
    if (existing && existing !== socket) {
      existing.terminate();
    }
    this.sockets.set(serverId, socket);
  }

  unregister(serverId: string, socket: WebSocket): void {
    if (this.sockets.get(serverId) === socket) {
      this.sockets.delete(serverId);
    }
  }

  isOnline(serverId: string): boolean {
    return this.sockets.has(serverId);
  }

  send(serverId: string, message: PanelToAgent): boolean {
    const socket = this.sockets.get(serverId);
    if (!socket || socket.readyState !== socket.OPEN) return false;
    socket.send(JSON.stringify(message));
    return true;
  }

  async reconcileServer(serverId: string): Promise<void> {
    if (!this.isOnline(serverId)) {
      this.logger.debug(`server ${serverId} offline — desired state deferred`);
      return;
    }
    const services = await this.planner.desiredForServer(serverId);
    this.send(serverId, { type: 'Reconcile', services });
  }

  async reconcileForService(serviceId: string): Promise<void> {
    const serverId = await this.repository.serverIdForService(serviceId);
    if (serverId) await this.reconcileServer(serverId);
  }

  removeService(serverId: string, serviceId: string): void {
    this.send(serverId, { type: 'RemoveService', serviceId });
  }

  closeAll(): void {
    for (const socket of this.sockets.values()) {
      socket.terminate();
    }
    this.sockets.clear();
  }
}
