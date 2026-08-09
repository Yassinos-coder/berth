import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SecretCipher } from '../common/crypto/secret-cipher.service';
import type { CreateSourceIntegrationDto } from './source-integrations.controller';
@Injectable()
export class SourceIntegrationsService {
  constructor(private readonly prisma: PrismaService, private readonly cipher: SecretCipher) {}
  list(orgId: string) { return this.prisma.sourceCredential.findMany({ where: { orgId }, select: { id: true, provider: true, name: true, host: true, username: true, createdAt: true } }); }
  create(orgId: string, dto: CreateSourceIntegrationDto) { return this.prisma.sourceCredential.upsert({ where: { orgId_provider_host: { orgId, provider: dto.provider, host: dto.host.toLowerCase() } }, create: { orgId, provider: dto.provider, name: dto.name, host: dto.host.toLowerCase(), username: dto.username, tokenEncrypted: this.cipher.encrypt(dto.token) }, update: { name: dto.name, username: dto.username, tokenEncrypted: this.cipher.encrypt(dto.token) }, select: { id: true, provider: true, name: true, host: true, username: true, createdAt: true } }); }
  async remove(orgId: string, id: string) { const result = await this.prisma.sourceCredential.deleteMany({ where: { id, orgId } }); if (!result.count) throw new NotFoundException('Source integration not found'); }
  async authenticatedUrl(orgId: string, repository: string): Promise<string> {
    let url: URL; try { url = new URL(repository); } catch { return repository; }
    const credential = await this.prisma.sourceCredential.findFirst({ where: { orgId, host: url.hostname.toLowerCase() } });
    if (!credential) return repository;
    url.username = credential.username; url.password = this.cipher.decrypt(credential.tokenEncrypted);
    return url.toString();
  }
}
