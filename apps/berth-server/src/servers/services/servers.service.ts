import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomBytes } from 'node:crypto';
import { ActivityKind } from '@prisma/client';
import { ServerRepository } from '../repositories/server.repository';
import { ServerMapper } from '../mappers/server.mapper';
import { ActivityService } from '../../activity/activity.service';
import type { AppConfig } from '../../config/configuration';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { EnrollmentDto, ServerDto } from '../interfaces';

const BOOTSTRAP_TTL_MS = 15 * 60_000;

@Injectable()
export class ServersService {
  constructor(
    private readonly repository: ServerRepository,
    private readonly activityService: ActivityService,
    private readonly configService: ConfigService<AppConfig, true>,
  ) {}

  async list(orgId: string): Promise<ServerDto[]> {
    const servers = await this.repository.listByOrg(orgId);
    return servers.map(ServerMapper.toDto);
  }

  async getById(orgId: string, id: string): Promise<ServerDto> {
    const server = await this.repository.findById(orgId, id);
    if (!server) throw new NotFoundException('Server not found');
    return ServerMapper.toDto(server);
  }

  async enroll(user: AuthenticatedUser, name: string): Promise<EnrollmentDto> {
    const token = randomBytes(24).toString('base64url');
    const expiresAt = new Date(Date.now() + BOOTSTRAP_TTL_MS);
    const panelUrl = this.configService.get('publicPanelUrl');
    const agentRepoUrl = this.configService.get('agentRepoUrl');
    const envParts = [`BERTH_BOOTSTRAP='${token}'`];

    if (panelUrl) {
      envParts.push(`BERTH_PANEL_URL='${panelUrl}'`);
    }

    if (agentRepoUrl) {
      envParts.push(`BERTH_REPO_URL='${agentRepoUrl}'`);
    }

    await this.repository.createEnrolling({
      orgId: user.orgId,
      name,
      bootstrapToken: token,
      bootstrapExpires: expiresAt,
    });
    await this.activityService.record(user.orgId, {
      kind: ActivityKind.server,
      title: `Server ${name} enrolling`,
      detail: 'Bootstrap token issued — waiting for the agent to dial back.',
      actor: user.id,
    });
    return {
      token,
      installCommand: `curl -fsSL https://berth.sh/install | ${envParts.join(' ')} sudo bash`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  async remove(orgId: string, id: string): Promise<void> {
    const removed = await this.repository.delete(orgId, id);
    if (!removed) throw new NotFoundException('Server not found');
  }
}
