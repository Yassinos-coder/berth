import { Injectable, Logger } from '@nestjs/common';
import { DeploymentStatus, DeploymentTrigger, type Prisma, type Service } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import { TelemetryBuffer } from '../../agent-gateway/buffers/telemetry-buffer.service';
import { InternalDomainUtil } from '../../common/utils/internal-domain.util';
import type { PullRequestEvent } from '../interfaces';
import { PreviewMapper } from '../mappers/preview.mapper';

const withPreviewSources = { envVars: true, proxyHosts: true } satisfies Prisma.ServiceInclude;

@Injectable()
export class PreviewsService {
  private readonly logger = new Logger(PreviewsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agents: AgentRegistry,
    private readonly telemetry: TelemetryBuffer,
  ) {}

  async handle(orgId: string, event: PullRequestEvent): Promise<number> {
    const parents = await this.prisma.service.findMany({
      where: {
        orgId,
        sourceKind: 'git',
        repo: event.repo,
        branch: event.baseRef,
        previewsEnabled: true,
        previewOfId: null,
      },
      include: withPreviewSources,
    });

    for (const parent of parents) {
      if (event.action === 'closed') {
        await this.teardown(parent, event);
        continue;
      }
      await this.deploy(parent, event);
    }
    return parents.length;
  }

  private async deploy(
    parent: Service & Prisma.ServiceGetPayload<{ include: typeof withPreviewSources }>,
    event: PullRequestEvent,
  ): Promise<void> {
    const existing = await this.prisma.service.findFirst({
      where: { previewOfId: parent.id, prNumber: event.number },
    });

    const preview = existing
      ? await this.prisma.service.update({
          where: { id: existing.id },
          data: { branch: event.headRef, specHash: event.headSha, state: 'building' },
        })
      : await this.create(parent, event);

    await this.prisma.deployment.create({
      data: {
        orgId: parent.orgId,
        serviceId: preview.id,
        status: DeploymentStatus.queued,
        trigger: DeploymentTrigger.push,
        branch: event.headRef,
        commitSha: event.headSha,
        commitMessage: event.title,
        author: event.author,
      },
    });
    await this.agents.reconcileForService(preview.id, true);
  }

  private async create(
    parent: Service & Prisma.ServiceGetPayload<{ include: typeof withPreviewSources }>,
    event: PullRequestEvent,
  ): Promise<Service> {
    const preview = await this.prisma.service.create({
      data: {
        ...PreviewMapper.toCreateData(
          parent,
          event,
          InternalDomainUtil.generate(PreviewMapper.name(parent.name, event)),
        ),
        state: 'building',
        envVars: {
          create: parent.envVars.map((item) => ({
            key: item.key,
            value: item.value,
            isSecret: item.isSecret,
          })),
        },
      },
    });

    for (const host of parent.proxyHosts.filter((item) => item.path === '/')) {
      await this.prisma.proxyHost
        .create({
          data: {
            orgId: parent.orgId,
            serviceId: preview.id,
            domain: PreviewMapper.domain(host.domain, event),
            path: '/',
            targetPort: host.targetPort,
            ssl: host.ssl,
            forceHttps: host.forceHttps,
          },
        })
        .catch((error) => this.logger.warn(`preview proxy host skipped: ${error}`));
    }
    return preview;
  }

  private async teardown(parent: Service, event: PullRequestEvent): Promise<void> {
    const preview = await this.prisma.service.findFirst({
      where: { previewOfId: parent.id, prNumber: event.number },
    });
    if (!preview) return;

    await this.prisma.service.delete({ where: { id: preview.id } });
    this.telemetry.clear(preview.id);
    this.agents.removeService(preview.serverId, preview.id);
    await this.agents.reconcileServer(preview.serverId);
  }
}
