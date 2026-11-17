import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ActivityKind, DeploymentStatus, DeploymentTrigger, SourceKind } from '@prisma/client';
import { ActivityService } from '../../activity/activity.service';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import type { AuthenticatedUser } from '../../common/interfaces';
import { DeploymentRepository } from '../../deployments/repositories/deployment.repository';
import { ServerRepository } from '../../servers/repositories/server.repository';
import type { MoveServiceDto } from '../dto/move-service.dto';
import type { ServiceDto } from '../interfaces';
import { ServiceMapper } from '../mappers/service.mapper';
import { ServiceRepository } from '../repositories/service.repository';
import { ServiceMoveValidator } from '../validators/service-move.validator';
import { StorageQuotaService } from './storage-quota.service';

@Injectable()
export class ServiceMoveService {
  constructor(
    private readonly repository: ServiceRepository,
    private readonly servers: ServerRepository,
    private readonly deployments: DeploymentRepository,
    private readonly storageQuota: StorageQuotaService,
    private readonly activity: ActivityService,
    private readonly registry: AgentRegistry,
  ) {}

  async move(user: AuthenticatedUser, id: string, dto: MoveServiceDto): Promise<ServiceDto> {
    const service = await this.repository.findById(user.orgId, id);
    if (!service) throw new NotFoundException('Service not found');

    const target = await this.servers.findById(user.orgId, dto.serverId);
    const conflict = ServiceMoveValidator.conflict(
      { serverId: service.serverId, volumePath: service.volumePath, previewOfId: service.previewOfId },
      target ? { id: target.id, status: target.status } : null,
      dto.confirmDataLoss === true,
    );
    if (conflict) throw new BadRequestException(conflict);

    const moved = await this.repository.moveToServer(user.orgId, id, dto.serverId);
    if (moved.status === 'not-found') throw new NotFoundException('Service not found');
    if (moved.status === 'capacity') {
      throw new BadRequestException('The target server does not have enough CPU or memory for this service.');
    }
    if (moved.status === 'storage') {
      throw new BadRequestException(
        await this.storageQuota.explainShortfall(user.orgId, dto.serverId, service.diskGb ?? 0),
      );
    }

    if (service.sourceKind === SourceKind.git) {
      await this.deployments.create({
        orgId: user.orgId,
        serviceId: id,
        status: DeploymentStatus.queued,
        trigger: DeploymentTrigger.manual,
        author: user.id,
      });
    }

    await this.activity.record(user.orgId, {
      kind: ActivityKind.server,
      title: `${service.name} moved to ${moved.value.server.name}`,
      detail: `From ${service.server.name}. Point your domains at the new server's IP.`,
      actor: user.id,
    });

    await this.registry.reconcileServer(service.serverId);
    await this.registry.reconcileServer(dto.serverId);
    return ServiceMapper.toDto(moved.value, { cpuPct: 0, memMb: 0 });
  }
}
