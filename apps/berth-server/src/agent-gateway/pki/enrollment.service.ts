import {
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { AgentStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CaService } from './ca.service';

export interface EnrollmentResult {
  serverId: string;
  certPem: string;
  caPem: string;
}

@Injectable()
export class EnrollmentService {
  private readonly logger = new Logger(EnrollmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ca: CaService,
  ) {}

  async enroll(token: string, csrPem: string): Promise<EnrollmentResult> {
    if (!token) throw new ForbiddenException('Missing bootstrap token');

    const server = await this.prisma.server.findUnique({
      where: { bootstrapToken: token },
    });
    if (
      !server ||
      !server.bootstrapExpires ||
      server.bootstrapExpires.getTime() < Date.now()
    ) {
      throw new ForbiddenException('Invalid or expired bootstrap token');
    }

    const signed = this.ca.signCsr(csrPem, server.id);

    await this.prisma.server.update({
      where: { id: server.id },
      data: {
        bootstrapToken: null,
        bootstrapExpires: null,
        certSerial: signed.serial,
        status: AgentStatus.offline,
      },
    });

    this.logger.log(`server ${server.name} (${server.id}) enrolled`);
    return {
      serverId: server.id,
      certPem: signed.certPem,
      caPem: this.ca.caCertPem(),
    };
  }
}
