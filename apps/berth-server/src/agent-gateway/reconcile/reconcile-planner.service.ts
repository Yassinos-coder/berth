import { Injectable } from '@nestjs/common';
import type { ServiceSpec, ServiceSource } from '@berth/protocol';
import { ReconcileRepository, ServiceWithEnv } from './reconcile.repository';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';

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
    return {
      id: service.id,
      name: service.name,
      serverId: service.serverId,
      source: this.toSource(service),
      env: service.envVars.map((envVar) => ({
        key: envVar.key,
        value: this.cipher.decrypt(envVar.value),
        isSecret: envVar.isSecret,
      })),
      ports: service.domain
        ? [{ containerPort: 80, domain: service.domain, public: true }]
        : [],
      volumes: [],
      resources: {
        cpuCores: service.cpuCores,
        memoryMb: service.memoryMb,
        cpuShares: service.cpuShares ?? undefined,
      },
      restartPolicy: 'unless-stopped',
      replicas: service.replicas,
    };
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
