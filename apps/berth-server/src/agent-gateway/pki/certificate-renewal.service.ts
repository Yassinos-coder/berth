import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentRegistry } from '../registry/agent-registry.service';
import { CaService } from './ca.service';

@Injectable()
export class CertificateRenewalService {
  private readonly logger = new Logger(CertificateRenewalService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ca: CaService,
    private readonly registry: AgentRegistry,
  ) {}

  request(serverId: string): void {
    this.registry.send(serverId, { type: 'RenewCertificate' });
  }

  async issue(serverId: string, csrPem: string): Promise<void> {
    let signed;
    try {
      signed = this.ca.signCsr(csrPem, serverId);
    } catch (error) {
      this.logger.warn(`renewal for ${serverId} rejected: ${(error as Error).message}`);
      return;
    }
    await this.prisma.server.updateMany({
      where: { id: serverId },
      data: { pendingCertSerial: signed.serial },
    });
    this.registry.send(serverId, { type: 'CertificateIssued', certPem: signed.certPem });
    this.logger.log(`issued renewed certificate for server ${serverId}`);
  }

  async promote(serverId: string): Promise<void> {
    const server = await this.prisma.server.findUnique({
      where: { id: serverId },
      select: { pendingCertSerial: true },
    });
    if (!server?.pendingCertSerial) return;
    await this.prisma.server.updateMany({
      where: { id: serverId, pendingCertSerial: server.pendingCertSerial },
      data: { certSerial: server.pendingCertSerial, pendingCertSerial: null },
    });
    this.logger.log(`server ${serverId} is now using its renewed certificate`);
  }
}
