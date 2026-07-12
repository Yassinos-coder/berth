import { Injectable } from '@nestjs/common';
import type {
  PortMapping,
  ServiceSpec,
  ServiceSource,
  VolumeMount,
} from '@berth/protocol';
import { ReconcileRepository, ServiceWithEnv } from './reconcile.repository';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';

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
  ) {}

  async desiredForServer(serverId: string): Promise<ServiceSpec[]> {
    const services = await this.repository.servicesForServer(serverId);
    return services.map((service) => this.toSpec(service));
  }

  private toSpec(service: ServiceWithEnv): ServiceSpec {
    const env = service.envVars.map<ResolvedEnv>((envVar) => ({
      key: envVar.key,
      value: this.cipher.decrypt(envVar.value),
      isSecret: envVar.isSecret,
    }));

    return {
      id: service.id,
      name: service.name,
      serverId: service.serverId,
      source: this.toSource(service),
      env,
      ports: this.toPorts(service),
      volumes: this.toVolumes(service),
      command: this.toCommand(service, env),
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

  private toSource(service: ServiceWithEnv): ServiceSource {
    if (service.sourceKind === 'git') {
      return {
        kind: 'git',
        repo: service.repo ?? '',
        branch: service.branch ?? 'main',
        build: {
          builder: service.builder ?? 'auto',
          dockerfilePath: service.dockerfilePath ?? undefined,
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
