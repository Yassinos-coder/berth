import { Controller, Headers, Post, RawBodyRequest, Req, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import { DeploymentStatus, DeploymentTrigger } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { SkipCsrf } from '../common/decorators/skip-csrf.decorator';
import type { AppConfig } from '../config/configuration';
import { AgentRegistry } from '../agent-gateway/registry/agent-registry.service';
import { GithubInstallationRepository } from './github-installation.repository';
import { PrismaService } from '../prisma/prisma.service';

@Public()
@SkipCsrf()
@Controller('webhooks/github')
export class GithubWebhookController {
  constructor(private readonly config: ConfigService<AppConfig, true>, private readonly installations: GithubInstallationRepository, private readonly prisma: PrismaService, private readonly agents: AgentRegistry) {}

  @Post()
  async receive(@Req() request: RawBodyRequest<Request>, @Headers('x-hub-signature-256') signature = '', @Headers('x-github-event') event = '') {
    const secret = this.config.get('github.webhookSecret', { infer: true });
    const expected = `sha256=${createHmac('sha256', secret).update(request.rawBody ?? Buffer.alloc(0)).digest('hex')}`;
    if (!secret || signature.length !== expected.length || !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) throw new UnauthorizedException('Invalid GitHub signature');
    const body = request.body as Record<string, any>;
    if (event === 'installation' && body.action === 'deleted') {
      await this.installations.deleteByInstallationId(body.installation.id);
      return { ok: true };
    }
    if (event !== 'push' || !body.installation?.id) return { ok: true };
    const installation = await this.installations.findByInstallationId(body.installation.id);
    if (!installation) return { ok: true };
    const branch = String(body.ref ?? '').replace('refs/heads/', '');
    const services = await this.prisma.service.findMany({ where: { orgId: installation.orgId, sourceKind: 'git', repo: body.repository.full_name, branch } });
    await Promise.all(services.map(async (service) => {
      await this.prisma.service.update({ where: { id: service.id }, data: { specHash: body.after, state: 'building' } });
      await this.prisma.deployment.create({ data: { orgId: installation.orgId, serviceId: service.id, status: DeploymentStatus.queued, trigger: DeploymentTrigger.push, branch, commitSha: body.after, commitMessage: body.head_commit?.message, author: body.sender?.login } });
      await this.agents.reconcileForService(service.id);
    }));
    return { ok: true, deployments: services.length };
  }
}
