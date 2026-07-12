import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityKind,
  DeploymentStatus,
  DeploymentTrigger,
  ServiceKind,
  ServiceState,
  SourceKind,
} from '@prisma/client';
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
import { CreateServiceDto } from '../dto/create-service.dto';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { LogLine, MetricPoint, ServiceDto } from '../interfaces';

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
  ) {}

  async list(orgId: string): Promise<ServiceDto[]> {
    const services = await this.repository.listByOrg(orgId);
    return services.map(ServiceMapper.toDto);
  }

  async getById(orgId: string, id: string): Promise<ServiceDto> {
    const service = await this.repository.findById(orgId, id);
    if (!service) throw new NotFoundException('Service not found');
    return ServiceMapper.toDto(service);
  }

  async logs(orgId: string, id: string): Promise<LogLine[]> {
    await this.getById(orgId, id);
    return this.telemetry.getLogs(id);
  }

  async metrics(orgId: string, id: string): Promise<MetricPoint[]> {
    await this.getById(orgId, id);
    return this.telemetry.getMetrics(id);
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

    const service = await this.repository.create(input);

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
    return ServiceMapper.toDto(service);
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
    const generated = DatabaseTemplateFactory.build(dto.template!, dto.name);
    return {
      orgId: user.orgId,
      serverId: dto.serverId,
      name: dto.name,
      kind: ServiceKind.database,
      sourceKind: SourceKind.image,
      image: generated.image,
      tag: generated.tag,
      cpuCores: dto.resources.cpuCores,
      memoryMb: dto.resources.memoryMb,
      cpuShares: dto.resources.cpuShares,
      templateKind: generated.templateKind,
      containerPort: generated.containerPort,
      publicNetworking: dto.publicNetworking ?? false,
      volumeName: generated.volumeName,
      volumePath: generated.volumePath,
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
      publicNetworking: dto.publicNetworking ?? false,
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
