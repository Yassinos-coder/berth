import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Resolver } from 'node:dns/promises';
import { PrismaService } from '../../prisma/prisma.service';
import type { DnsCheckDto } from '../interfaces/dns-check';
import { DnsCheckUtil } from '../utils/dns-check.util';

const LOOKUP_TIMEOUT_MS = 3000;
const DOMAIN = /^(?!-)[a-z0-9-]+(\.[a-z0-9-]+)+$/i;

@Injectable()
export class DnsCheckService {
  constructor(private readonly prisma: PrismaService) {}

  async check(orgId: string, domain: string, serviceId: string): Promise<DnsCheckDto> {
    const name = domain.trim().toLowerCase();
    if (!DOMAIN.test(name)) throw new BadRequestException('Enter a valid domain, e.g. app.example.com');

    const service = await this.prisma.service.findFirst({
      where: { id: serviceId, orgId },
      select: { server: { select: { ip: true } } },
    });
    if (!service) throw new NotFoundException('Service not found');

    return DnsCheckUtil.evaluate(name, await this.resolve(name), service.server.ip);
  }

  private async resolve(domain: string): Promise<string[]> {
    const resolver = new Resolver({ timeout: LOOKUP_TIMEOUT_MS, tries: 1 });
    const [v4, v6] = await Promise.all([
      resolver.resolve4(domain).catch(() => [] as string[]),
      resolver.resolve6(domain).catch(() => [] as string[]),
    ]);
    return [...v4, ...v6];
  }
}
