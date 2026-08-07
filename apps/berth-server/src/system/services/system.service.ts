import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import type { SystemVersionDto } from '../interfaces';

const BRANCH = 'production';
const COMMITS_URL =
  'https://api.github.com/repos/Yassinos-coder/berth/commits/production';
const CACHE_MS = 10 * 60 * 1000;

@Injectable()
export class SystemService {
  private readonly logger = new Logger(SystemService.name);
  private readonly version = this.readVersion();
  private cache?: { sha: string; at: number };

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AgentRegistry,
  ) {}

  async getVersion(): Promise<SystemVersionDto> {
    const commit = process.env.BERTH_COMMIT ?? '';
    const latestCommit = await this.latestProductionSha();
    const updateAvailable = Boolean(
      commit && latestCommit && !latestCommit.startsWith(commit),
    );
    return { version: this.version, commit, latestCommit, updateAvailable, branch: BRANCH };
  }

  async triggerUpdate(orgId: string): Promise<{ started: boolean }> {
    const server = await this.prisma.server.findFirst({
      where: { orgId, isLocal: true },
    });
    if (!server) {
      throw new NotFoundException('No local server found to update');
    }
    const sent = this.registry.send(server.id, { type: 'SelfUpdate' });
    if (!sent) {
      throw new ConflictException(
        'The local agent is offline — run `sudo berth-update` on the host instead',
      );
    }
    return { started: true };
  }

  private async latestProductionSha(): Promise<string | null> {
    if (this.cache && Date.now() - this.cache.at < CACHE_MS) {
      return this.cache.sha;
    }
    try {
      const res = await fetch(COMMITS_URL, {
        headers: {
          Accept: 'application/vnd.github+json',
          'User-Agent': 'berth-panel',
        },
        signal: AbortSignal.timeout(6000),
      });
      if (!res.ok) return this.cache?.sha ?? null;
      const data = (await res.json()) as { sha?: string };
      if (!data.sha) return this.cache?.sha ?? null;
      this.cache = { sha: data.sha, at: Date.now() };
      return data.sha;
    } catch {
      return this.cache?.sha ?? null;
    }
  }

  private readVersion(): string {
    try {
      const pkg = readFileSync(resolve(process.cwd(), 'package.json'), 'utf8');
      return (JSON.parse(pkg) as { version?: string }).version ?? '0.0.0';
    } catch {
      return '0.0.0';
    }
  }
}
