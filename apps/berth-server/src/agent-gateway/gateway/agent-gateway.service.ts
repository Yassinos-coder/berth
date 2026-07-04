import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as https from 'node:https';
import type * as tls from 'node:tls';
import type { IncomingMessage } from 'node:http';
import { WebSocketServer, type WebSocket, type RawData } from 'ws';
import { AgentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CaService } from '../pki/ca.service';
import { EnrollmentService } from '../pki/enrollment.service';
import { AgentRegistry } from '../registry/agent-registry.service';
import { AgentMessageHandler } from '../handlers/agent-message.handler';
import { AgentMessageValidator } from '../validators/agent-message.validator';

const MAX_PAYLOAD = 512 * 1024;
const HEARTBEAT_MS = 30_000;
const ENROLL_TIMEOUT_MS = 10_000;

@Injectable()
export class AgentGatewayService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(AgentGatewayService.name);
  private server?: https.Server;
  private wss?: WebSocketServer;

  constructor(
    private readonly config: ConfigService,
    private readonly ca: CaService,
    private readonly enrollment: EnrollmentService,
    private readonly registry: AgentRegistry,
    private readonly handler: AgentMessageHandler,
    private readonly prisma: PrismaService,
  ) {}

  onModuleInit(): void {
    const { cert, key, ca } = this.ca.tlsOptions();
    this.server = https.createServer({
      cert,
      key,
      ca,
      requestCert: true,
      rejectUnauthorized: false,
      minVersion: 'TLSv1.2',
    });
    this.wss = new WebSocketServer({
      server: this.server,
      maxPayload: MAX_PAYLOAD,
    });
    this.wss.on('connection', (ws, req) => this.onConnection(ws, req));

    const port = this.config.get<number>('agentWsPort')!;
    this.server.listen(port, () =>
      this.logger.log(`agent gateway listening on wss://0.0.0.0:${port}`),
    );
  }

  onApplicationShutdown(): void {
    this.registry.closeAll();
    this.wss?.close();
    this.server?.close();
  }

  private onConnection(ws: WebSocket, req: IncomingMessage): void {
    const url = new URL(req.url ?? '/', 'https://localhost');
    if (url.pathname === '/enroll') {
      this.handleEnroll(ws, url);
      return;
    }
    if (url.pathname === '/agent') {
      this.handleAgent(ws, req);
      return;
    }
    ws.close(1008, 'unknown path');
  }

  private handleEnroll(ws: WebSocket, url: URL): void {
    const token = url.searchParams.get('bootstrap') ?? '';
    const timeout = setTimeout(() => {
      if (ws.readyState === ws.OPEN) ws.close();
    }, ENROLL_TIMEOUT_MS);

    ws.once('message', async (data: RawData) => {
      try {
        const payload = JSON.parse(data.toString()) as { csr?: string };
        if (!payload.csr) throw new Error('missing CSR');
        const result = await this.enrollment.enroll(token, payload.csr);
        ws.send(
          JSON.stringify({
            serverId: result.serverId,
            certPem: result.certPem,
            caPem: result.caPem,
          }),
        );
      } catch (error) {
        ws.send(JSON.stringify({ error: (error as Error).message }));
      } finally {
        clearTimeout(timeout);
        ws.close();
      }
    });
  }

  private handleAgent(ws: WebSocket, req: IncomingMessage): void {
    const socket = req.socket as tls.TLSSocket;
    if (!socket.authorized) {
      ws.close(1008, 'client certificate required');
      return;
    }
    const cn = socket.getPeerCertificate()?.subject?.CN;
    const serverId = Array.isArray(cn) ? cn[0] : cn;
    if (!serverId) {
      ws.close(1008, 'client certificate missing CN');
      return;
    }

    this.registry.register(serverId, ws);
    void this.markStatus(serverId, AgentStatus.online);
    void this.registry
      .reconcileServer(serverId)
      .catch((error) => this.logger.error(`initial reconcile failed`, error));

    let alive = true;
    ws.on('pong', () => {
      alive = true;
    });
    const heartbeat = setInterval(() => {
      if (!alive) {
        ws.terminate();
        return;
      }
      alive = false;
      ws.ping();
    }, HEARTBEAT_MS);

    ws.on('message', (data: RawData) => {
      const message = AgentMessageValidator.parse(data.toString());
      if (!message) return;
      void this.handler
        .handle(serverId, message)
        .catch((error) => this.logger.error('handler error', error));
    });

    const cleanup = () => {
      clearInterval(heartbeat);
      this.registry.unregister(serverId, ws);
      void this.markStatus(serverId, AgentStatus.offline);
    };
    ws.on('close', cleanup);
    ws.on('error', cleanup);
  }

  private async markStatus(
    serverId: string,
    status: AgentStatus,
  ): Promise<void> {
    await this.prisma.server
      .updateMany({
        where: { id: serverId },
        data: { status, lastSeenAt: new Date() },
      })
      .catch(() => undefined);
  }
}
