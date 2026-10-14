import { Injectable } from '@nestjs/common';
import type {
  PortMapping,
  PanelRoute,
  ProxyRoute,
  ServiceSpec,
  ServiceSource,
  VolumeMount,
} from '@berth/protocol';
import { EnvReferenceResolver, ReferenceTarget } from './env-reference.resolver';
import { ReconcileRepository, ServiceWithEnv } from './reconcile.repository';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { GithubAppService } from '../../github-app/github-app.service';
import { SourceIntegrationsService } from '../../source-integrations/source-integrations.service';

interface ResolvedEnv {
  key: string;
  value: string;
  isSecret: boolean;
}

@Injectable()
export class ReconcilePlanner {
  constructor(
    private readonly repository: ReconcileRepository,
    private readonly cipher: SecretCipher,
    private readonly github: GithubAppService,
    private readonly sources: SourceIntegrationsService,
  ) {}

  async desiredForServer(serverId: string): Promise<ServiceSpec[]> {
    const services = await this.repository.servicesForServer(serverId);
    const targets = EnvReferenceResolver.index(
      services.map((service) => this.toReferenceTarget(service)),
    );
    return Promise.all(services.map((service) => this.toSpec(service, targets)));
  }

  proxyRoutesForServer(serverId: string): Promise<ProxyRoute[]> {
    return this.repository.proxyRoutesForServer(serverId);
  }

  panelRouteForServer(serverId: string): Promise<PanelRoute | undefined> {
    return this.repository.panelRouteForServer(serverId);
  }

  private toReferenceTarget(service: ServiceWithEnv): ReferenceTarget {
    return {
      name: service.name,
      containerPort: service.containerPort,
      env: service.envVars.map((envVar) => ({
        key: envVar.key,
        value: this.cipher.decrypt(envVar.value),
      })),
    };
  }

  private async toSpec(
    service: ServiceWithEnv,
    targets: Map<string, ReferenceTarget>,
  ): Promise<ServiceSpec> {
    const env = service.envVars.map<ResolvedEnv>((envVar) => ({
      key: envVar.key,
      value: EnvReferenceResolver.resolve(this.cipher.decrypt(envVar.value), targets),
      isSecret: envVar.isSecret,
    }));

    return {
      id: service.id,
      name: service.name,
      serverId: service.serverId,
      source: await this.toSource(service, env),
      env,
      ports: this.toPorts(service),
      volumes: this.toVolumes(service),
      command: this.toCommand(service, env),
      aliases: service.internalDomains,
      resources: {
        cpuCores: service.cpuCores,
        memoryMb: service.memoryMb,
        cpuShares: service.cpuShares ?? undefined,
      },
      restartPolicy: 'unless-stopped',
      replicas: service.replicas,
      templateKind: service.templateKind ?? undefined,
      registryAuth: service.registryCredential
        ? {
            server: service.registryCredential.server,
            username: service.registryCredential.username,
            password: this.cipher.decrypt(service.registryCredential.passwordEncrypted),
          }
        : undefined,
      targetPlatform: service.targetPlatform as 'linux/amd64' | 'linux/arm64' | undefined,
    };
  }

  private toPorts(service: ServiceWithEnv): PortMapping[] {
    if (service.containerPort) {
      return [
        {
          containerPort: service.containerPort,
          public: service.publicNetworking,
        },
      ];
    }
    if (service.domain) {
      return [{ containerPort: 80, domain: service.domain, public: true }];
    }
    return [];
  }

  private toVolumes(service: ServiceWithEnv): VolumeMount[] {
    if (service.volumeName && service.volumePath) {
      return [{ name: service.volumeName, mountPath: service.volumePath }];
    }
    return [];
  }

  private toCommand(service: ServiceWithEnv, env: ResolvedEnv[]): string[] {
    if (['redis', 'valkey', 'keydb'].includes(service.templateKind ?? '')) {
      const password = env.find((item) => item.key === 'REDIS_PASSWORD')?.value;
      if (password) {
        const binary = service.templateKind === 'keydb' ? 'keydb-server' : service.templateKind === 'valkey' ? 'valkey-server' : 'redis-server';
        return [binary, '--requirepass', password, '--appendonly', 'yes'];
      }
    }
    return service.command ?? [];
  }

  private async toSource(
    service: ServiceWithEnv,
    env: ResolvedEnv[],
  ): Promise<ServiceSource> {
    if (service.sourceKind === 'git') {
      const buildArgs = Object.fromEntries(
        env
          .filter(({ key }) => /^VITE_[A-Z0-9_]+$/.test(key))
          .map(({ key, value }) => [key, value]),
      );
      return {
        kind: 'git',
        repo: await this.cloneUrl(service.orgId, service.repo ?? ''),
        branch: service.branch ?? 'main',
        build: {
          builder: service.builder ?? 'auto',
          dockerfilePath: service.dockerfilePath ?? undefined,
          buildArgs:
            Object.keys(buildArgs).length > 0 ? buildArgs : undefined,
          rootDirectory: service.rootDirectory ?? undefined,
          buildCommand: service.buildCommand ?? undefined,
          startCommand: service.startCommand ?? undefined,
          revision: service.specHash ?? undefined,
        },
      };
    }
    return {
      kind: 'image',
      image: service.image ?? '',
      tag: service.tag ?? 'latest',
    };
  }

  private async cloneUrl(orgId: string, repository: string): Promise<string> {
    if (/^https?:\/\//i.test(repository)) return this.sources.authenticatedUrl(orgId, repository);
    if (/^git@/i.test(repository)) return repository;
    return this.github.cloneUrl(orgId, repository);
  }
}
