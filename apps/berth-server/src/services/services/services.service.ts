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
import { randomBytes } from 'node:crypto';
import { ServiceRepository } from '../repositories/service.repository';
import { ServiceMapper } from '../mappers/service.mapper';
import { ServiceSourceValidator } from '../validators/service-source.validator';
import { DatabaseTemplateFactory } from '../templates/database-template.factory';
import { ServerRepository } from '../../servers/repositories/server.repository';
import { DeploymentRepository } from '../../deployments/repositories/deployment.repository';
import { ActivityService } from '../../activity/activity.service';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import { TelemetryBuffer } from '../../agent-gateway/buffers/telemetry-buffer.service';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { RegistryCredentialRepository } from '../../registry-credentials/repositories/registry-credential.repository';
import { CreateServiceDto } from '../dto/create-service.dto';
import { UpdateServiceDto } from '../dto/update-service.dto';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { LogLine, MetricPeak, MetricPoint, ServiceDto } from '../interfaces';

function emptyToNull(value?: string): string | null | undefined {
  if (value === undefined) return undefined;
  return value.trim() === '' ? null : value;
}

function generateInternalDomain(name: string): string {
  const slug =
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'service';
  return `${slug}-${randomBytes(3).toString('hex')}.berth.local`;
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
    private readonly deployments: DeploymentRepository,
    private readonly activityService: ActivityService,
    private readonly registry: AgentRegistry,
    private readonly telemetry: TelemetryBuffer,
    private readonly cipher: SecretCipher,
    private readonly registryCredentials: RegistryCredentialRepository,
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

    const input = dto.template
      ? this.buildFromTemplate(user, dto)
      : this.buildFromSource(user, dto);

    const service = await this.repository.create({
      ...input,
      internalDomains: [generateInternalDomain(dto.name)],
    });

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
    const updated = await this.repository.updateBuildConfig(user.orgId, id, {
      name: name && name.length > 0 ? name : undefined,
      rootDirectory: emptyToNull(dto.rootDirectory),
      buildCommand: emptyToNull(dto.buildCommand),
      startCommand: emptyToNull(dto.startCommand),
      dockerfilePath: emptyToNull(dto.dockerfilePath),
      builder: dto.builder as Builder | undefined,
      registryCredentialId,
      targetPlatform: dto.targetPlatform,
    });
    if (!updated) throw new NotFoundException('Service not found');

    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: `${updated.name} updated`,
      detail: touchesBuild
        ? 'Redeploy to apply the new build configuration.'
        : 'Service settings updated.',
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

    const domain = customDomain?.trim() || generateInternalDomain(service.name);
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

    await this.repository.updateState(user.orgId, id, ACTION_STATE[action]);

    if (action === 'redeploy') {
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
    return {
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
