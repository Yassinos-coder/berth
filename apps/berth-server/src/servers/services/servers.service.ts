import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { ActivityKind } from '@prisma/client';
import { ServerRepository } from '../repositories/server.repository';
import { ServerMapper } from '../mappers/server.mapper';
import { ActivityService } from '../../activity/activity.service';
import { StorageBudgetValidator } from '../../common/validators/storage-budget.validator';
import { CaService } from '../../agent-gateway/pki/ca.service';
import type { AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { EnrollmentDto, ServerDto } from '../interfaces';

const BOOTSTRAP_TTL_MS = 60 * 60_000;

@Injectable()
export class ServersService {
  constructor(
    private readonly repository: ServerRepository,
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService<AppConfig, true>,
    private readonly ca: CaService,
  ) {}

  async list(orgId: string): Promise<ServerDto[]> {
    const [servers, allocated] = await Promise.all([
      this.repository.listByOrg(orgId),
      this.repository.allocatedDiskByServer(orgId),
    ]);
    return servers.map((server) =>
      ServerMapper.toDto(server, allocated.get(server.id) ?? 0),
    );
  }

  async getById(orgId: string, id: string): Promise<ServerDto> {
    const server = await this.repository.findById(orgId, id);
    if (!server) throw new NotFoundException('Server not found');
    const allocated = await this.repository.allocatedDiskByServer(orgId);
    return ServerMapper.toDto(server, allocated.get(id) ?? 0);
  }

  async updateStorageBudget(
    user: AuthenticatedUser,
    id: string,
    storageBudgetGb: number,
  ): Promise<ServerDto> {
    const server = await this.repository.findById(user.orgId, id);
    if (!server) throw new NotFoundException('Server not found');

    const allocated = (await this.repository.allocatedDiskByServer(user.orgId)).get(id) ?? 0;
    const problem = StorageBudgetValidator.budgetError(
      storageBudgetGb,
      allocated,
      server.os && server.diskGb > 0 ? server.diskGb : null,
    );
    if (problem) throw new BadRequestException(problem);

    const updated = await this.repository.updateStorageBudget(user.orgId, id, storageBudgetGb);
    if (!updated) throw new NotFoundException('Server not found');
    await this.activityService.record(user.orgId, {
      kind: ActivityKind.server,
      title: `${server.name} storage budget set to ${storageBudgetGb} GB`,
      actor: user.id,
    });
    return ServerMapper.toDto(updated, allocated);
  }

  async enroll(
    user: AuthenticatedUser,
    name: string,
    storageBudgetGb?: number,
  ): Promise<EnrollmentDto> {
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + BOOTSTRAP_TTL_MS);

    await this.repository.createEnrolling({
      orgId: user.orgId,
      name,
      bootstrapToken: token,
      bootstrapExpires: expiresAt,
      storageBudgetGb,
    });
    await this.activityService.record(user.orgId, {
      kind: ActivityKind.server,
      title: `Server ${name} enrolling`,
      detail: 'Bootstrap token issued — waiting for the agent to dial back.',
      actor: user.id,
    });
    return this.buildEnrollment(token, expiresAt);
  }

  async reenroll(user: AuthenticatedUser, id: string): Promise<EnrollmentDto> {
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + BOOTSTRAP_TTL_MS);
    const server = await this.repository.regenerateBootstrap(
      user.orgId,
      id,
      token,
      expiresAt,
    );
    if (!server) throw new NotFoundException('Server not found');
    await this.activityService.record(user.orgId, {
      kind: ActivityKind.server,
      title: `Server ${server.name} re-enrolling`,
      detail: 'A fresh bootstrap token was issued.',
      actor: user.id,
    });
    return this.buildEnrollment(token, expiresAt);
  }

  private buildEnrollment(token: string, expiresAt: Date): EnrollmentDto {
    const panelUrl = this.configService.get('publicPanelUrl');
    const agentRepoUrl = this.configService.get('agentRepoUrl');
    const installUrl = this.configService.get('agentInstallUrl');
    const envParts = [`BERTH_BOOTSTRAP='${token}'`, `BERTH_CA_SHA256='${this.ca.caFingerprint()}'`];

    if (panelUrl) {
      envParts.push(`BERTH_PANEL_URL='${panelUrl}'`);
    }

    if (agentRepoUrl) {
      envParts.push(`BERTH_REPO_URL='${agentRepoUrl}'`);
    }

    return {
      token,
      installCommand: `curl -fsSL ${installUrl} | ${envParts.join(' ')} sudo bash`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async remove(orgId: string, id: string): Promise<void> {
    const removed = await this.repository.delete(orgId, id);
    if (!removed) throw new NotFoundException('Server not found');
  }
}
