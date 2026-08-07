import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import * as jwt from 'jsonwebtoken';
import { AppConfig } from '../config/configuration';
import { GithubInstallationRepository } from './github-installation.repository';
import { GithubBranchDto, GithubRepoDto, GithubStatusDto } from './interfaces';

const GITHUB_API = 'https://api.github.com';
const INSTALL_STATE_TTL_MS = 10 * 60_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface PendingInstall {
  orgId: string;
  expiresAt: number;
}

interface InstallState {
  orgId: string;
  jti: string;
}

@Injectable()
export class GithubAppService {
  private readonly logger = new Logger(GithubAppService.name);
  private readonly tokenCache = new Map<number, CachedToken>();
  private readonly pendingInstalls = new Map<string, PendingInstall>();

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly installations: GithubInstallationRepository,
  ) {}

  isConfigured(): boolean {
    const gh = this.config.get('github', { infer: true });
    return Boolean(gh.appId && gh.privateKey && gh.appSlug);
  }

  async status(orgId: string): Promise<GithubStatusDto> {
    const installation = await this.installations.findByOrg(orgId);
    return {
      configured: this.isConfigured(),
      connected: Boolean(installation),
      accountLogin: installation?.accountLogin,
    };
  }

  buildInstallUrl(orgId: string): string {
    this.prunePendingInstalls();
    const jti = randomUUID();
    this.pendingInstalls.set(jti, {
      orgId,
      expiresAt: Date.now() + INSTALL_STATE_TTL_MS,
    });
    const state = jwt.sign({ orgId, jti } satisfies InstallState, this.jwtSecret(), {
      algorithm: 'HS256',
      expiresIn: '10m',
    });
    const gh = this.config.get('github', { infer: true });
    return `https://github.com/apps/${gh.appSlug}/installations/new?state=${encodeURIComponent(state)}`;
  }

  async completeInstallation(
    state: string,
    installationId: number,
  ): Promise<void> {
    if (!Number.isInteger(installationId) || installationId <= 0) {
      throw new BadRequestException('Invalid installation id');
    }

    const payload = this.verifyInstallState(state);
    const pending = this.pendingInstalls.get(payload.jti);
    if (!pending || pending.orgId !== payload.orgId || pending.expiresAt < Date.now()) {
      throw new BadRequestException('Invalid or expired install state');
    }
    this.pendingInstalls.delete(payload.jti);

    const existing = await this.installations.findByInstallationId(installationId);
    if (existing && existing.orgId !== payload.orgId) {
      throw new ForbiddenException(
        'Installation is already linked to another organization',
      );
    }

    const login = await this.accountLogin(installationId);
    await this.installations.upsert(payload.orgId, installationId, login);
  }

  async accountLogin(installationId: number): Promise<string> {
    const data = await this.appRequest<{ account: { login: string } }>(
      `/app/installations/${installationId}`,
    );
    return data.account.login;
  }

  private verifyInstallState(state: string): InstallState {
    try {
      return jwt.verify(state, this.jwtSecret(), {
        algorithms: ['HS256'],
      }) as InstallState;
    } catch {
      throw new BadRequestException('Invalid install state');
    }
  }

  private jwtSecret(): string {
    return this.config.get('jwtSecret', { infer: true });
  }

  private prunePendingInstalls(): void {
    const now = Date.now();
    for (const [jti, entry] of this.pendingInstalls) {
      if (entry.expiresAt < now) this.pendingInstalls.delete(jti);
    }
  }

  async listRepos(orgId: string): Promise<GithubRepoDto[]> {
    const token = await this.tokenForOrg(orgId);
    if (!token) return [];

    const repos: GithubRepoDto[] = [];
    for (let page = 1; page <= 5; page += 1) {
      const data = await this.installationRequest<{
        repositories: Array<{
          full_name: string;
          private: boolean;
          default_branch: string;
        }>;
      }>(token, `/installation/repositories?per_page=100&page=${page}`);

      repos.push(
        ...data.repositories.map((r) => ({
          fullName: r.full_name,
          private: r.private,
          defaultBranch: r.default_branch,
        })),
      );

      if (data.repositories.length < 100) break;
    }

    return repos;
  }

  async listBranches(
    orgId: string,
    fullName: string,
  ): Promise<GithubBranchDto[]> {
    const token = await this.tokenForOrg(orgId);
    if (!token) return [];

    const data = await this.installationRequest<Array<{ name: string }>>(
      token,
      `/repos/${fullName}/branches?per_page=100`,
    );
    return data.map((b) => ({ name: b.name }));
  }

  async cloneUrl(orgId: string, fullName: string): Promise<string> {
    const token = await this.tokenForOrg(orgId);
    if (!token) return `https://github.com/${fullName}.git`;
    return `https://x-access-token:${token}@github.com/${fullName}.git`;
  }

  private async tokenForOrg(orgId: string): Promise<string | null> {
    const installation = await this.installations.findByOrg(orgId);
    if (!installation) return null;
    return this.installationToken(installation.installationId);
  }

  private async installationToken(installationId: number): Promise<string> {
    const cached = this.tokenCache.get(installationId);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;

    const data = await this.appRequest<{ token: string; expires_at: string }>(
      `/app/installations/${installationId}/access_tokens`,
      'POST',
    );

    this.tokenCache.set(installationId, {
      token: data.token,
      expiresAt: new Date(data.expires_at).getTime(),
    });
    return data.token;
  }

  private appJwt(): string {
    const gh = this.config.get('github', { infer: true });
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iat: now - 30, exp: now + 540, iss: gh.appId },
      gh.privateKey,
      { algorithm: 'RS256' },
    );
  }

  private appRequest<T>(
    path: string,
    method: 'GET' | 'POST' = 'GET',
  ): Promise<T> {
    return this.request<T>(path, method, `Bearer ${this.appJwt()}`);
  }

  private installationRequest<T>(token: string, path: string): Promise<T> {
    return this.request<T>(path, 'GET', `token ${token}`);
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    authorization: string,
  ): Promise<T> {
    const response = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers: {
        Authorization: authorization,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'berth-panel',
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      const body = await response.text();
      this.logger.warn(`GitHub ${method} ${path} → ${response.status}: ${body}`);
      throw new Error(`GitHub API ${response.status}`);
    }

    return response.json() as Promise<T>;
  }
}
