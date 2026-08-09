import { Injectable } from '@nestjs/common';
import type { WebSocket } from 'ws';
import type { AgentToPanel } from '@berth/protocol';
import { AgentRegistry } from '../registry/agent-registry.service';

interface ExecSession {
  browser: WebSocket;
  serverId: string;
}

@Injectable()
export class ExecSessionService {
  private readonly sessions = new Map<string, ExecSession>();

  constructor(private readonly agents: AgentRegistry) {}

  start(sessionId: string, browser: WebSocket, serverId: string, containerName: string): boolean {
    if (!this.agents.send(serverId, { type: 'ExecStart', sessionId, containerName })) return false;
    this.sessions.set(sessionId, { browser, serverId });
    return true;
  }

  input(sessionId: string, data: string): void {
    const session = this.sessions.get(sessionId);
    if (session) this.agents.send(session.serverId, { type: 'ExecInput', sessionId, data });
  }

  stop(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    this.agents.send(session.serverId, { type: 'ExecStop', sessionId });
  }

  handle(message: Extract<AgentToPanel, { type: 'ExecOutput' | 'ExecExit' }>): void {
    const session = this.sessions.get(message.sessionId);
    if (!session) return;
    if (session.browser.readyState === session.browser.OPEN) {
      session.browser.send(JSON.stringify(message));
    }
    if (message.type === 'ExecExit') this.sessions.delete(message.sessionId);
  }
}
