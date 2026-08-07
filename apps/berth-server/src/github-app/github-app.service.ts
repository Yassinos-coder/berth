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
import { SecretCipher } from '../common/crypto/secret-cipher.service';
import { GithubInstallationRepository } from './github-installation.repository';
import { GithubAppRepository } from './github-app.repository';
import {
  GithubBranchDto,
  GithubManifestDto,
  GithubRepoDto,
  GithubStatusDto,
} from './interfaces';

const GITHUB_API = 'https://api.github.com';
const STATE_TTL_MS = 10 * 60_000;

interface CachedToken {
  token: string;
  expiresAt: number;
}

interface PendingState {
  subject: string;
  expiresAt: number;
}

interface SignedState {
  subject: string;
  jti: string;
}

interface GithubCredentials {
  appId: string;
  slug: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  privateKey: string;
}

interface ManifestConversion {
  id: number;
  slug: string;
  client_id: string;
  client_secret: string;
  webhook_secret: string;
  pem: string;
}

@Injectable()
export class GithubAppService {
  private readonly logger = new Logger(GithubAppService.name);
  private readonly tokenCache = new Map<number, CachedToken>();
  private readonly pendingInstalls = new Map<string, PendingState>();
  private readonly pendingManifests = new Map<string, PendingState>();

  constructor(
    private readonly config: ConfigService<AppConfig, true>,
    private readonly installations: GithubInstallationRepository,
    private readonly apps: GithubAppRepository,
    private readonly cipher: SecretCipher,
  ) {}

  async isConfigured(): Promise<boolean> {
    return (await this.credentials()) !== null;
  }

  async status(orgId: string): Promise<GithubStatusDto> {
    const [configured, installation] = await Promise.all([
      this.isConfigured(),
      this.installations.findByOrg(orgId),
    ]);
    return {
      configured,
      connected: Boolean(installation),
      accountLogin: installation?.accountLogin,
    };
  }

  buildManifest(userId: string): GithubManifestDto {
    const state = this.mintState(this.pendingManifests, userId);
    const base = this.panelBaseUrl();
    const manifest = {
      name: `Berth ${randomUUID().slice(0, 8)}`,
      url: base,
      hook_attributes: { url: `${base}/api/webhooks/github`, active: true },
      redirect_url: `${base}/api/github/manifest/callback`,
      callback_urls: [`${base}/api/github/callback`],
      setup_url: `${base}/api/github/callback`,
      setup_on_update: false,
      public: false,
      default_permissions: { contents: 'read', metadata: 'read' },
      default_events: ['push'],
    };
    return {
      url: `https://github.com/settings/apps/new?state=${encodeURIComponent(state)}`,
      manifest,
    };
  }

  async convertManifest(code: string, state: string): Promise<void> {
    if (!code) throw new BadRequestException('Missing manifest code');
    this.consumeState(this.pendingManifests, state);

    const data = await this.request<ManifestConversion>(
      `/app-manifests/${encodeURIComponent(code)}/conversions`,
      'POST',
    );

    await this.apps.upsert({
      appId: data.id,
      slug: data.slug,
      clientId: data.client_id ?? '',
      clientSecret: this.cipher.encrypt(data.client_secret ?? ''),
      webhookSecret: this.cipher.encrypt(data.webhook_secret ?? ''),
      privateKey: this.cipher.encrypt(data.pem),
    });
    this.logger.log(`GitHub App '${data.slug}' created via manifest flow`);
  }

  async buildInstallUrl(orgId: string): Promise<string> {
    const creds = await this.requireCredentials();
    const state = this.mintState(this.pendingInstalls, orgId);
    return `https://github.com/apps/${creds.slug}/installations/new?state=${encodeURIComponent(state)}`;
  }

  async completeInstallation(
    state: string,
    installationId: number,
  ): Promise<void> {
    if (!Number.isInteger(installationId) || installationId <= 0) {
      throw new BadRequestException('Invalid installation id');
    }

    const orgId = this.consumeState(this.pendingInstalls, state);

    const existing = await this.installations.findByInstallationId(installationId);
    if (existing && existing.orgId !== orgId) {
      throw new ForbiddenException(
        'Installation is already linked to another organization',
      );
    }

    const login = await this.accountLogin(installationId);
    await this.installations.upsert(orgId, installationId, login);
  }

  async accountLogin(installationId: number): Promise<string> {
    const data = await this.appRequest<{ account: { login: string } }>(
      `/app/installations/${installationId}`,
    );
    return data.account.login;
  }

  async webhookSecret(): Promise<string> {
    const creds = await this.credentials();
    return creds?.webhookSecret ?? '';
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

  private async credentials(): Promise<GithubCredentials | null> {
    const row = await this.apps.find();
    if (row) {
      return {
        appId: String(row.appId),
        slug: row.slug,
        clientId: row.clientId,
        clientSecret: this.cipher.decrypt(row.clientSecret),
        webhookSecret: this.cipher.decrypt(row.webhookSecret),
        privateKey: this.cipher.decrypt(row.privateKey),
      };
    }

    const gh = this.config.get('github', { infer: true });
    if (gh.appId && gh.privateKey && gh.appSlug) {
      return {
        appId: gh.appId,
        slug: gh.appSlug,
        clientId: gh.clientId,
        clientSecret: gh.clientSecret,
        webhookSecret: gh.webhookSecret,
        privateKey: gh.privateKey,
      };
    }

    return null;
  }

  private async requireCredentials(): Promise<GithubCredentials> {
    const creds = await this.credentials();
    if (!creds) throw new BadRequestException('GitHub App is not configured');
    return creds;
  }

  private mintState(
    store: Map<string, PendingState>,
    subject: string,
  ): string {
    this.pruneStates(store);
    const jti = randomUUID();
    store.set(jti, { subject, expiresAt: Date.now() + STATE_TTL_MS });
    return jwt.sign({ subject, jti } satisfies SignedState, this.jwtSecret(), {
      algorithm: 'HS256',
      expiresIn: '10m',
    });
  }

  private consumeState(store: Map<string, PendingState>, state: string): string {
    let payload: SignedState;
    try {
      payload = jwt.verify(state, this.jwtSecret(), {
        algorithms: ['HS256'],
      }) as SignedState;
    } catch {
      throw new BadRequestException('Invalid state');
    }

    const pending = store.get(payload.jti);
    if (!pending || pending.subject !== payload.subject || pending.expiresAt < Date.now()) {
      throw new BadRequestException('Invalid or expired state');
    }
    store.delete(payload.jti);
    return payload.subject;
  }

  private pruneStates(store: Map<string, PendingState>): void {
    const now = Date.now();
    for (const [jti, entry] of store) {
      if (entry.expiresAt < now) store.delete(jti);
    }
  }

  private jwtSecret(): string {
    return this.config.get('jwtSecret', { infer: true });
  }

  private panelBaseUrl(): string {
    return this.config.get('corsOrigin', { infer: true }).replace(/\/+$/, '');
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

  private async appJwt(): Promise<string> {
    const creds = await this.requireCredentials();
    const now = Math.floor(Date.now() / 1000);
    return jwt.sign(
      { iat: now - 30, exp: now + 540, iss: creds.appId },
      creds.privateKey,
      { algorithm: 'RS256' },
    );
  }

  private async appRequest<T>(
    path: string,
    method: 'GET' | 'POST' = 'GET',
  ): Promise<T> {
    return this.request<T>(path, method, `Bearer ${await this.appJwt()}`);
  }

  private installationRequest<T>(token: string, path: string): Promise<T> {
    return this.request<T>(path, 'GET', `token ${token}`);
  }

  private async request<T>(
    path: string,
    method: 'GET' | 'POST',
    authorization?: string,
  ): Promise<T> {
    const headers: Record<string, string> = {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'berth-panel',
    };
    if (authorization) headers.Authorization = authorization;

    const response = await fetch(`${GITHUB_API}${path}`, {
      method,
      headers,
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
