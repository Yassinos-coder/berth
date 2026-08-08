import { Injectable } from '@nestjs/common';
import type {
  PortMapping,
  ProxyRoute,
  ServiceSpec,
  ServiceSource,
  VolumeMount,
} from '@berth/protocol';
import { ReconcileRepository, ServiceWithEnv } from './reconcile.repository';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { GithubAppService } from '../../github-app/github-app.service';

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
  ) {}

  async desiredForServer(serverId: string): Promise<ServiceSpec[]> {
    const services = await this.repository.servicesForServer(serverId);
    return Promise.all(services.map((service) => this.toSpec(service)));
  }

  proxyRoutesForServer(serverId: string): Promise<ProxyRoute[]> {
    return this.repository.proxyRoutesForServer(serverId);
  }

  private async toSpec(service: ServiceWithEnv): Promise<ServiceSpec> {
    const env = service.envVars.map<ResolvedEnv>((envVar) => ({
      key: envVar.key,
      value: this.cipher.decrypt(envVar.value),
      isSecret: envVar.isSecret,
    }));

    return {
      id: service.id,
      name: service.name,
      serverId: service.serverId,
      source: await this.toSource(service),
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
    if (service.templateKind === 'redis') {
      const password = env.find((item) => item.key === 'REDIS_PASSWORD')?.value;
      if (password) {
        return ['redis-server', '--requirepass', password, '--appendonly', 'yes'];
      }
    }
    return service.command ?? [];
  }

  private async toSource(service: ServiceWithEnv): Promise<ServiceSource> {
    if (service.sourceKind === 'git') {
      return {
        kind: 'git',
        repo: await this.github.cloneUrl(service.orgId, service.repo ?? ''),
        branch: service.branch ?? 'main',
        build: {
          builder: service.builder ?? 'auto',
          dockerfilePath: service.dockerfilePath ?? undefined,
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
}
