import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityKind,
  DeploymentStatus,
  DeploymentTrigger,
  ServiceState,
} from '@prisma/client';
import { ServiceRepository } from '../repositories/service.repository';
import { ServiceMapper } from '../mappers/service.mapper';
import { ServiceSourceValidator } from '../validators/service-source.validator';
import { ServerRepository } from '../../servers/repositories/server.repository';
import { DeploymentRepository } from '../../deployments/repositories/deployment.repository';
import { ActivityService } from '../../activity/activity.service';
import { CreateServiceDto } from '../dto/create-service.dto';
import type { AuthenticatedUser } from '../../common/interfaces';
import type { LogLine, MetricPoint, ServiceDto } from '../interfaces';

export type ServiceAction = 'start' | 'stop' | 'restart' | 'redeploy';

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
    return [];
  }

  async metrics(orgId: string, id: string): Promise<MetricPoint[]> {
    await this.getById(orgId, id);
    return [];
  }

  async create(
    user: AuthenticatedUser,
    dto: CreateServiceDto,
  ): Promise<ServiceDto> {
    const server = await this.servers.findById(user.orgId, dto.serverId);
    if (!server) throw new BadRequestException('Target server not found');

    const source = ServiceSourceValidator.normalize(dto);
    const service = await this.repository.create({
      orgId: user.orgId,
      serverId: dto.serverId,
      name: dto.name,
      kind: dto.kind,
      domain: dto.domain,
      cpuCores: dto.resources.cpuCores,
      memoryMb: dto.resources.memoryMb,
      cpuShares: dto.resources.cpuShares,
      ...source,
    });

    if (source.sourceKind === 'git') {
      await this.deployments.create({
        orgId: user.orgId,
        serviceId: service.id,
        status: DeploymentStatus.queued,
        trigger: DeploymentTrigger.manual,
        branch: source.branch,
        author: user.id,
      });
    }

    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: `${service.name} created`,
      detail: `Reconciling on ${service.server.name}`,
      actor: user.id,
    });

    return ServiceMapper.toDto(service);
  }

  async runAction(
    user: AuthenticatedUser,
    id: string,
    action: ServiceAction,
  ): Promise<{ ok: boolean }> {
    const result = await this.repository.updateState(
      user.orgId,
      id,
      ACTION_STATE[action],
    );
    if (result.count === 0) throw new NotFoundException('Service not found');

    if (action === 'redeploy') {
      await this.deployments.create({
        orgId: user.orgId,
        serviceId: id,
        status: DeploymentStatus.building,
        trigger: DeploymentTrigger.redeploy,
        author: user.id,
      });
    }

    await this.activityService.record(user.orgId, {
      kind: ActivityKind.deploy,
      title: `Service ${action} requested`,
      actor: user.id,
    });
    return { ok: true };
  }

  async remove(orgId: string, id: string): Promise<void> {
    const removed = await this.repository.delete(orgId, id);
    if (!removed) throw new NotFoundException('Service not found');
  }
}
