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
import { ServerHealthService } from '../health/server-health.service';
import { PrismaService } from '../../prisma/prisma.service';
import { CaService } from '../pki/ca.service';
import { EnrollmentService } from '../pki/enrollment.service';
import { AgentRegistry } from '../registry/agent-registry.service';
import { AgentMessageHandler } from '../handlers/agent-message.handler';
import { AgentMessageValidator } from '../validators/agent-message.validator';
import { CertificateRenewalService } from '../pki/certificate-renewal.service';
import { CertificateRenewalValidator } from '../validators/certificate-renewal.validator';
import { AgentIdentityValidator } from '../validators/agent-identity.validator';
import { CaDownloadValidator } from '../validators/ca-download.validator';
import { ProtocolVersionValidator } from '../validators/protocol-version.validator';

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
    private readonly certificateRenewal: CertificateRenewalService,
    private readonly health: ServerHealthService,
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
    this.server.on('request', (req, res) => {
      const response = CaDownloadValidator.respond(
        req.method,
        req.url,
        this.ca.tlsOptions().ca,
      );
      res.writeHead(response.status, { 'Content-Type': response.contentType });
      res.end(req.method === 'HEAD' ? undefined : response.body);
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
      const versionError = ProtocolVersionValidator.check(
        url.searchParams.get('protocol'),
      );
      if (versionError) {
        this.logger.warn(`agent connection refused: ${versionError}`);
        ws.close(1008, versionError);
        return;
      }
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

    const remoteAddress = (socket.remoteAddress ?? '').replace(/^::ffff:/, '');
    const peerCertificate = socket.getPeerCertificate();
    const presentedSerial = peerCertificate?.serialNumber;
    const renewalDue = CertificateRenewalValidator.shouldRenew(
      peerCertificate?.valid_from,
      peerCertificate?.valid_to,
      new Date(),
    );
    const authorized = this.authorizeAgent(serverId, presentedSerial);

    ws.on('message', (data: RawData) => {
      const message = AgentMessageValidator.parse(data.toString());
      if (!message) return;
      void authorized.then((ok) => {
        if (!ok) return;
        return this.handler.handle(serverId, message);
      }).catch((error) => this.logger.error('handler error', error));
    });

    void authorized.then((ok) => {
      if (!ok) {
        ws.close(1008, 'certificate not accepted');
        return;
      }
      this.startAgentSession(ws, serverId, remoteAddress);
      if (renewalDue) this.certificateRenewal.request(serverId);
    });
  }

  private async authorizeAgent(
    serverId: string,
    presentedSerial: string | undefined,
  ): Promise<boolean> {
    const server = await this.prisma.server
      .findUnique({
        where: { id: serverId },
        select: { certSerial: true, pendingCertSerial: true, bootstrapToken: true },
      })
      .catch(() => undefined);
    if (server === undefined) return false;
    const rejection = AgentIdentityValidator.check(server, presentedSerial);
    if (!rejection) {
      if (server && AgentIdentityValidator.matchesPending(server, presentedSerial)) {
        await this.certificateRenewal.promote(serverId).catch(() => undefined);
      }
      return true;
    }
    this.logger.warn(`agent ${serverId} refused: ${rejection}`);
    return false;
  }

  private startAgentSession(
    ws: WebSocket,
    serverId: string,
    remoteAddress: string,
  ): void {
    this.registry.register(serverId, ws);
    void this.markStatus(serverId, AgentStatus.online, remoteAddress || undefined).then(() =>
      this.health.onConnected(serverId),
    );
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
    ip?: string,
  ): Promise<void> {
    await this.prisma.server
      .updateMany({
        where: { id: serverId },
        data: { status, lastSeenAt: new Date(), ...(ip ? { ip } : {}) },
      })
      .catch(() => undefined);
  }
}
