import { Injectable, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type RawData, type WebSocket } from 'ws';
import type { JwtPayload } from '../../common/interfaces';
import { PrismaService } from '../../prisma/prisma.service';
import { SessionRepository } from '../../auth/repositories/session.repository';
import { ExecSessionService } from '../exec/exec-session.service';

@Injectable()
export class BrowserExecGateway implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly wss = new WebSocketServer({ noServer: true, maxPayload: 64 * 1024 });
  private upgradeHandler?: (request: IncomingMessage, socket: any, head: Buffer) => void;

  constructor(
    private readonly adapter: HttpAdapterHost,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly sessions: SessionRepository,
    private readonly prisma: PrismaService,
    private readonly exec: ExecSessionService,
  ) {}

  onApplicationBootstrap(): void {
    const server = this.adapter.httpAdapter.getHttpServer();
    this.upgradeHandler = (request, socket, head) => {
      const match = new URL(request.url ?? '/', 'http://localhost').pathname.match(/^\/api\/services\/([^/]+)\/exec$/);
      if (!match) return;
      this.wss.handleUpgrade(request, socket, head, (ws) => void this.connect(ws, request, decodeURIComponent(match[1])));
    };
    server.on('upgrade', this.upgradeHandler);
  }

  onApplicationShutdown(): void {
    const server = this.adapter.httpAdapter.getHttpServer();
    if (this.upgradeHandler) server.off('upgrade', this.upgradeHandler);
    this.wss.close();
  }

  private async connect(ws: WebSocket, request: IncomingMessage, serviceId: string): Promise<void> {
    const payload = await this.authenticate(request);
    if (!payload) return ws.close(1008, 'unauthorized');
    const service = await this.prisma.service.findFirst({ where: { id: serviceId, orgId: payload.orgId }, select: { serverId: true } });
    if (!service) return ws.close(1008, 'service not found');

    const sessionId = randomUUID();
    if (!this.exec.start(sessionId, ws, service.serverId, `berth-${serviceId}`)) return ws.close(1013, 'agent offline');
    ws.on('message', (raw: RawData) => this.onMessage(sessionId, raw));
    ws.once('close', () => this.exec.stop(sessionId));
    ws.once('error', () => this.exec.stop(sessionId));
  }

  private onMessage(sessionId: string, raw: RawData): void {
    try {
      const message = JSON.parse(raw.toString()) as { type?: string; data?: string };
      if (message.type === 'input' && typeof message.data === 'string' && message.data.length <= 65536) {
        this.exec.input(sessionId, message.data);
      }
    } catch { /* Invalid browser frames are ignored. */ }
  }

  private async authenticate(request: IncomingMessage): Promise<JwtPayload | null> {
    const cookie = request.headers.cookie?.split(';').map((part) => part.trim()).find((part) => part.startsWith('berth_session='));
    const protocol = request.headers['sec-websocket-protocol']
      ?.split(',')
      .map((value) => value.trim())
      .find((value) => value.startsWith('berth.token.'));
    const protocolToken = protocol
      ? Buffer.from(protocol.slice('berth.token.'.length), 'base64url').toString('utf8')
      : '';
    const token = cookie ? decodeURIComponent(cookie.slice('berth_session='.length)) : protocolToken;
    if (!token) return null;
    try {
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, { secret: this.config.get<string>('jwtSecret') });
      if (!payload.sid) return null;
      const session = await this.sessions.findById(payload.sid);
      return session?.userId === payload.sub && session.orgId === payload.orgId ? payload : null;
    } catch { return null; }
  }
}
