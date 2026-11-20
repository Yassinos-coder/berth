import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityKind,
  Builder,
  DeploymentStatus,
  DeploymentTrigger,
  ServiceKind,
  ServiceState,
  SourceKind,
} from '@prisma/client';
import { ServiceRepository } from '../repositories/service.repository';
import { ServiceMapper } from '../mappers/service.mapper';
import { ServiceSourceValidator } from '../validators/service-source.validator';
import { ServiceVolumeValidator } from '../validators/service-volume.validator';
import { DatabaseTemplateFactory } from '../templates/database-template.factory';
import { AppTemplateFactory } from '../templates/app-template.factory';
import { ServerRepository } from '../../servers/repositories/server.repository';
import { DeploymentRepository } from '../../deployments/repositories/deployment.repository';
import { ActivityService } from '../../activity/activity.service';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import { TelemetryBuffer } from '../../agent-gateway/buffers/telemetry-buffer.service';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { RegistryCredentialRepository } from '../../registry-credentials/repositories/registry-credential.repository';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';
import { ScaleServiceDto } from '../dto/scale-service.dto';
import { ReplicaPolicyValidator } from '../validators/replica-policy.validator';
import { DeployStrategyValidator } from '../validators/deploy-strategy.validator';
import { StorageBudgetValidator } from '../../common/validators/storage-budget.validator';
import { StorageQuotaService } from './storage-quota.service';
import { ReplicaEngineService } from './replica-engine.service';
import type { AuthenticatedUser } from '../../common/interfaces';
import { InternalDomainUtil } from '../../common/utils/internal-domain.util';
import type { LogLine, MetricPeak, MetricPoint, ServiceDto } from '../interfaces';

function emptyToNull(value?: string): string | null | undefined {
  if (value === undefined) return undefined;
  return value.trim() === '' ? null : value;
}

export type ServiceAction = 'start' | 'stop' | 'restart' | 'redeploy';

type CreateInput = Parameters<ServiceRepository['create']>[0];

const ACTION_STATE: Record<ServiceAction, ServiceState> = {
  start: ServiceState.starting,
  stop: ServiceState.stopped,
  restart: ServiceState.starting,
  redeploy: ServiceState.building,
};

@Injectable()
export class ServicesService {
  constructor(
    private readonly repository: ServiceRepository,
    private readonly servers: ServerRepository,
    private readonly storageQuota: StorageQuotaService,
    private readonly deployments: DeploymentRepository,
    private readonly activityService: ActivityService,
    private readonly registry: AgentRegistry,
    private readonly telemetry: TelemetryBuffer,
    private readonly cipher: SecretCipher,
    private readonly registryCredentials: RegistryCredentialRepository,
    private readonly replicaEngine: ReplicaEngineService,
  ) {}

  async list(orgId: string): Promise<ServiceDto[]> {
    const services = await this.repository.listByOrg(orgId);
    return services.map((service) =>
      ServiceMapper.toDto(service, this.usageFor(service.id)),
    );
  }

  async getById(orgId: string, id: string): Promise<ServiceDto> {
    const service = await this.repository.findById(orgId, id);
    if (!service) throw new NotFoundException('Service not found');
    return ServiceMapper.toDto(service, this.usageFor(id));
  }

  private usageFor(id: string): { cpuPct: number; memMb: number } {
    const latest = this.telemetry.getMetrics(id).at(-1);
    return latest ? { cpuPct: latest.cpuPct, memMb: latest.memMb } : { cpuPct: 0, memMb: 0 };
  }

  async logs(orgId: string, id: string): Promise<LogLine[]> {
    await this.getById(orgId, id);
    return this.telemetry.getLogs(id);
  }

  async metrics(orgId: string, id: string): Promise<MetricPoint[]> {
    await this.getById(orgId, id);
    return this.telemetry.getMetrics(id);
  }

  async metricsPeak(orgId: string, id: string): Promise<MetricPeak> {
    await this.getById(orgId, id);
    return this.telemetry.getDailyPeak(id);
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateServiceDto,
  ): Promise<ServiceDto> {
    const server = await this.servers.findById(user.orgId, dto.serverId);
    if (!server) throw new BadRequestException('Target server not found');

    if (
      dto.environmentId &&
      !(await this.repository.environmentExists(user.orgId, dto.environmentId))
    ) {
      throw new BadRequestException('Environment not found');
    }

    const input = dto.template
      ? this.buildFromTemplate(user, dto)
      : this.buildFromSource(user, dto);

    const strategyConflict = DeployStrategyValidator.conflict({
      strategy: dto.deployStrategy ?? 'rolling',
      replicas: dto.replicas ?? input.replicas ?? 1,
      autoscaled: DeployStrategyValidator.isAutoscaled(dto.replicaPolicy),
    });
    if (strategyConflict) throw new BadRequestException(strategyConflict);

    const creation = await this.repository.create({
      ...input,
      deployStrategy: dto.deployStrategy,
      stopGracePeriodSeconds: dto.stopGracePeriodSeconds,
      volumeLimited: Boolean((input.volumePath ?? dto.volumePath) && (input.diskGb ?? dto.diskGb)),
      replicas: dto.replicas ?? input.replicas ?? 1,
      replicaPolicy: dto.replicaPolicy
        ? ReplicaPolicyValidator.toJson(
            this.replicaEngine.normalizePolicy(dto.replicaPolicy),
          )
        : undefined,
      environmentId: dto.environmentId,
      internalDomains: [InternalDomainUtil.generate(dto.name)],
    });
    if (creation.status === 'capacity') {
      throw new BadRequestException(
        'Service CPU or memory limits exceed the target server capacity',
      );
    }
    if (creation.status === 'storage') {
      throw new BadRequestException(
        await this.storageQuota.explainShortfall(user.orgId, dto.serverId, dto.diskGb ?? 0),
      );
    }
    if (creation.status === 'not-found') {
      throw new BadRequestException('Target server not found');
    }
    const service = creation.value;

    if (service.sourceKind === SourceKind.git) {
      await this.deployments.create({
        orgId: user.orgId,
        serviceId: service.id,
        status: DeploymentStatus.queued,
        trigger: DeploymentTrigger.manual,
        author: user.id,
      });
    }

    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: `${service.name} created`,
      detail: `Reconciling on ${service.server.name}`,
      actor: user.id,
    });

    await this.registry.reconcileServer(dto.serverId);
    return ServiceMapper.toDto(service, this.usageFor(service.id));
  }

  async updateSettings(
    user: AuthenticatedUser,
    id: string,
    dto: UpdateServiceDto,
  ): Promise<ServiceDto> {
    const service = await this.repository.findById(user.orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const volumeChange = this.resolveVolumeChange(service, dto.volumePath);

    const touchesBuild = [
      dto.rootDirectory,
      dto.buildCommand,
      dto.startCommand,
      dto.dockerfilePath,
      dto.builder,
    ].some((value) => value !== undefined);
    if (touchesBuild && service.sourceKind !== SourceKind.git) {
      throw new BadRequestException(
        'Build settings only apply to git-source services',
      );
    }

    let registryCredentialId: string | null | undefined;
    if (dto.registryCredentialId !== undefined) {
      const trimmed = dto.registryCredentialId.trim();
      if (trimmed.length === 0) {
        registryCredentialId = null;
      } else {
        const credential = await this.registryCredentials.findById(
          user.orgId,
          trimmed,
        );
        if (!credential) {
          throw new BadRequestException('Registry credential not found');
        }
        registryCredentialId = trimmed;
      }
    }

    const name = dto.name?.trim();
    if (dto.replicas !== undefined && (dto.replicas < 1 || dto.replicas > 32)) {
      throw new BadRequestException('Replica count must be between 1 and 32');
    }
    const touchesResources = dto.resources !== undefined || dto.diskGb !== undefined;
    if (dto.enforceDiskLimit && dto.diskGb === undefined && !service.diskGb) {
      throw new BadRequestException('Choose a storage size to enforce.');
    }
    if (dto.diskGb !== undefined) {
      const sizeError = StorageBudgetValidator.sizeError(dto.diskGb);
      if (sizeError) throw new BadRequestException(sizeError);
      if (!volumeChange?.volumePath && !service.volumePath) {
        throw new BadRequestException(
          'Add a persistent volume path before choosing a storage size.',
        );
      }
    }
    const strategyConflict = DeployStrategyValidator.conflict({
      strategy: dto.deployStrategy ?? service.deployStrategy,
      replicas: dto.replicas ?? service.replicas,
      autoscaled: DeployStrategyValidator.isAutoscaled(
        dto.replicaPolicy ??
          ReplicaPolicyValidator.fromStored(service.replicaPolicy),
      ),
    });
    if (strategyConflict) throw new BadRequestException(strategyConflict);

    const update = await this.repository.updateBuildConfig(user.orgId, id, {
      name: name && name.length > 0 ? name : undefined,
      rootDirectory: emptyToNull(dto.rootDirectory),
      buildCommand: emptyToNull(dto.buildCommand),
      startCommand: emptyToNull(dto.startCommand),
      dockerfilePath: emptyToNull(dto.dockerfilePath),
      builder: dto.builder as Builder | undefined,
      registryCredentialId,
      targetPlatform: dto.targetPlatform,
      releaseCommand: emptyToNull(dto.releaseCommand),
      previewsEnabled: dto.previewsEnabled,
      alertsMuted: dto.alertsMuted,
      volumeLimited: dto.enforceDiskLimit === true ? true : undefined,
      diskGb: dto.diskGb,
      deployStrategy: dto.deployStrategy,
      stopGracePeriodSeconds: dto.stopGracePeriodSeconds,
      autoRollback: dto.autoRollback,
      replicas: dto.replicas,
      replicaPolicy: dto.replicaPolicy
        ? ReplicaPolicyValidator.toJson(
            this.replicaEngine.normalizePolicy(dto.replicaPolicy),
          )
        : undefined,
      cpuCores: dto.resources?.cpuCores,
      memoryMb: dto.resources?.memoryMb,
      cpuShares: dto.resources?.cpuShares,
      ...volumeChange,
    });
    if (update.status === 'capacity') {
      throw new BadRequestException(
        'Replica CPU or memory limits exceed the target server capacity',
      );
    }
    if (update.status === 'storage') {
      throw new BadRequestException(
        await this.storageQuota.explainShortfall(
          user.orgId,
          service.serverId,
          dto.diskGb ?? service.diskGb ?? 0,
          id,
        ),
      );
    }
    if (update.status === 'not-found') {
      throw new NotFoundException('Service not found');
    }
    const updated = update.value;

    if (touchesResources) {
      await this.registry.reconcileServer(service.serverId, [id]);
    }
    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: `${updated.name} updated`,
      detail:
        touchesResources
          ? 'Resource limits updated and live reconciliation requested.'
          : touchesBuild || volumeChange
          ? 'Redeploy to apply the new configuration.'
          : 'Service settings updated.',
      actor: user.id,
    });
    return ServiceMapper.toDto(updated, this.usageFor(updated.id));
  }

  async scale(
    user: AuthenticatedUser,
    id: string,
    dto: ScaleServiceDto,
  ): Promise<ServiceDto> {
    const service = await this.repository.findById(user.orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const nextReplicas = dto.replicas ?? service.replicas;
    if (nextReplicas < 1 || nextReplicas > 32) {
      throw new BadRequestException('Replica count must be between 1 and 32');
    }
    const strategyConflict = DeployStrategyValidator.conflict({
      strategy: service.deployStrategy,
      replicas: nextReplicas,
      autoscaled: DeployStrategyValidator.isAutoscaled(dto.replicaPolicy),
    });
    if (strategyConflict) throw new BadRequestException(strategyConflict);

    const update = await this.repository.updateReplicas(
      user.orgId,
      id,
      nextReplicas,
      dto.replicaPolicy
        ? ReplicaPolicyValidator.toJson(
            this.replicaEngine.normalizePolicy(dto.replicaPolicy),
          )
        : undefined,
    );
    if (update.status === 'capacity') {
      throw new BadRequestException(
        'Replica CPU or memory limits exceed the target server capacity',
      );
    }
    if (update.status === 'not-found' || update.status === 'storage') {
      throw new NotFoundException('Service not found');
    }
    const updated = update.value;

    await this.registry.reconcileServer(service.serverId, [id]);
    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: `${updated.name} scaled`,
      detail: `Replica count ${service.replicas} -> ${updated.replicas}.`,
      actor: user.id,
    });

    return ServiceMapper.toDto(updated, this.usageFor(updated.id));
  }

  async getEnv(
    orgId: string,
    id: string,
  ): Promise<{ key: string; value: string; isSecret: boolean }[]> {
    await this.getById(orgId, id);
    const env = await this.repository.listEnv(id);
    return env.map((item) => ({
      key: item.key,
      value: this.cipher.decrypt(item.value),
      isSecret: item.isSecret,
    }));
  }

  async setEnv(
    user: AuthenticatedUser,
    id: string,
    env: { key: string; value: string; isSecret?: boolean }[],
  ): Promise<{ key: string; value: string; isSecret: boolean }[]> {
    const service = await this.repository.findById(user.orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const cleaned = env
      .map((item) => ({
        key: item.key.trim(),
        value: item.value,
        isSecret: Boolean(item.isSecret),
      }))
      .filter((item) => item.key.length > 0);

    await this.repository.replaceEnv(id, this.encryptEnv(cleaned));
    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: `${service.name} variables updated`,
      detail: `${cleaned.length} variable(s) — redeploy to apply.`,
      actor: user.id,
    });
    return this.getEnv(user.orgId, id);
  }

  async addInternalDomain(
    user: AuthenticatedUser,
    id: string,
    customDomain?: string,
  ): Promise<ServiceDto> {
    const service = await this.repository.findById(user.orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const domain = customDomain?.trim() || InternalDomainUtil.generate(service.name);
    if (customDomain) {
      const siblings = await this.repository.listByOrg(user.orgId);
      const taken = siblings.some(
        (other) =>
          other.id !== id &&
          other.serverId === service.serverId &&
          other.internalDomains.includes(domain),
      );
      if (taken) {
        throw new BadRequestException(
          `"${domain}" is already used by another service on this server`,
        );
      }
    }

    const updated = await this.repository.updateInternalDomains(user.orgId, id, [
      ...service.internalDomains,
      domain,
    ]);
    if (!updated) throw new NotFoundException('Service not found');
    await this.registry.reconcileServer(service.serverId);
    return ServiceMapper.toDto(updated, this.usageFor(updated.id));
  }

  async removeInternalDomain(
    user: AuthenticatedUser,
    id: string,
    domain: string,
  ): Promise<ServiceDto> {
    const service = await this.repository.findById(user.orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const next = service.internalDomains.filter((entry) => entry !== domain);
    const updated = await this.repository.updateInternalDomains(
      user.orgId,
      id,
      next,
    );
    if (!updated) throw new NotFoundException('Service not found');
    await this.registry.reconcileServer(service.serverId);
    return ServiceMapper.toDto(updated, this.usageFor(updated.id));
  }

  async runAction(
    user: AuthenticatedUser,
    id: string,
    action: ServiceAction,
  ): Promise<{ ok: boolean }> {
    const service = await this.repository.findById(user.orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const stateUpdate = await this.repository.updateStateWithCapacity(
      user.orgId,
      id,
      ACTION_STATE[action],
    );
    if (stateUpdate.status === 'capacity') {
      throw new BadRequestException(
        'Service CPU or memory limits exceed the target server capacity',
      );
    }
    if (stateUpdate.status === 'not-found') {
      throw new NotFoundException('Service not found');
    }

    if (action === 'redeploy') {
      await this.deployments.clearServiceCommitPin(user.orgId, id);
      await this.deployments.create({
        orgId: user.orgId,
        serviceId: id,
        status: DeploymentStatus.building,
        trigger: DeploymentTrigger.redeploy,
        author: user.id,
      });
    }

    if (action === 'stop') {
      this.registry.removeService(service.serverId, id);
    } else if (action === 'redeploy') {
      await this.registry.reconcileServer(service.serverId, [id]);
    } else {
      await this.registry.reconcileServer(service.serverId);
    }

    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: `Service ${action} requested`,
      actor: user.id,
    });
    return { ok: true };
  }

  async remove(orgId: string, id: string): Promise<void> {
    const service = await this.repository.findById(orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const { serverId } = service;
    await this.repository.delete(orgId, id);
    this.telemetry.clear(id);
    this.registry.removeService(serverId, id);
    await this.registry.reconcileServer(serverId);
  }

  private buildFromTemplate(
    user: AuthenticatedUser,
    dto: CreateServiceDto,
  ): CreateInput {
    if (AppTemplateFactory.isApp(dto.template!)) {
      return this.buildFromAppTemplate(user, dto);
    }
    const generated = DatabaseTemplateFactory.build(dto.template!, dto.name, {
      username: dto.username,
      password: dto.password,
    });
    return {
      orgId: user.orgId,
      serverId: dto.serverId,
      name: dto.name,
      kind:
        generated.targetKind === 'bucket'
          ? ServiceKind.bucket
          : ServiceKind.database,
      sourceKind: SourceKind.image,
      image: generated.image,
      tag: generated.tag,
      cpuCores: dto.resources.cpuCores,
      memoryMb: dto.resources.memoryMb,
      cpuShares: dto.resources.cpuShares,
      diskGb: dto.diskGb,
      replicas: dto.replicas ?? 1,
      templateKind: generated.templateKind,
      containerPort: generated.containerPort,
      publicNetworking: dto.publicNetworking ?? false,
      volumeName: generated.volumeName,
      volumePath: generated.volumePath,
      command: generated.command,
      env: this.encryptEnv(generated.env),
    };
  }

  private buildFromAppTemplate(
    user: AuthenticatedUser,
    dto: CreateServiceDto,
  ): CreateInput {
    const generated = AppTemplateFactory.build(dto.template!, dto.name);
    return {
      orgId: user.orgId,
      serverId: dto.serverId,
      name: dto.name,
      kind: ServiceKind.image,
      domain: dto.domain,
      sourceKind: SourceKind.image,
      image: generated.image,
      tag: generated.tag,
      cpuCores: dto.resources.cpuCores,
      memoryMb: dto.resources.memoryMb,
      cpuShares: dto.resources.cpuShares,
      diskGb: dto.diskGb,
      replicas: dto.replicas ?? 1,
      templateKind: generated.templateKind,
      containerPort: generated.containerPort,
      publicNetworking: dto.publicNetworking ?? false,
      volumeName: generated.volumeName,
      volumePath: generated.volumePath,
      command: generated.command,
      env: this.encryptEnv(generated.env),
    };
  }

  private buildFromSource(
    user: AuthenticatedUser,
    dto: CreateServiceDto,
  ): CreateInput {
    if (!dto.source) {
      throw new BadRequestException('A source or template is required');
    }
    const source = ServiceSourceValidator.normalize(dto);
    const volumePath = dto.volumePath
      ? ServiceVolumeValidator.normalize(dto.volumePath)
      : null;
    return {
      ...(volumePath
        ? {
            volumeName: ServiceVolumeValidator.volumeNameFor(dto.name),
            volumePath,
          }
        : {}),
      orgId: user.orgId,
      serverId: dto.serverId,
      name: dto.name,
      kind: dto.kind,
      domain: dto.domain,
      cpuCores: dto.resources.cpuCores,
      memoryMb: dto.resources.memoryMb,
      cpuShares: dto.resources.cpuShares,
      diskGb: dto.diskGb,
      publicNetworking: dto.publicNetworking ?? false,
      containerPort: dto.containerPort,
      command: dto.command,
      env: this.encryptEnv(
        (dto.env ?? []).map((item) => ({
          key: item.key,
          value: item.value,
          isSecret: Boolean(item.isSecret),
        })),
      ),
      ...source,
    };
  }

  private resolveVolumeChange(
    service: { templateKind: string | null; volumeName: string | null; name: string },
    rawPath: string | undefined,
  ): { volumeName?: string; volumePath: string | null } | undefined {
    if (rawPath === undefined) return undefined;
    if (service.templateKind) {
      throw new BadRequestException(
        'The volume of a template service is managed by the template',
      );
    }
    const volumePath = ServiceVolumeValidator.normalize(rawPath);
    if (!volumePath) return { volumePath: null };
    return {
      volumeName:
        service.volumeName ?? ServiceVolumeValidator.volumeNameFor(service.name),
      volumePath,
    };
  }

  private encryptEnv(
    env: { key: string; value: string; isSecret: boolean }[],
  ): { key: string; value: string; isSecret: boolean }[] {
    return env.map((item) => ({
      key: item.key,
      value: item.isSecret ? this.cipher.encrypt(item.value) : item.value,
      isSecret: item.isSecret,
    }));
  }
}
