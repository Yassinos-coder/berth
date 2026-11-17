import { Injectable } from '@nestjs/common';
import { ServerRepository } from '../../servers/repositories/server.repository';
import { ServiceRepository } from '../repositories/service.repository';
import {
  StorageBudgetValidator,
  type StorageSummary,
} from '../../common/validators/storage-budget.validator';

@Injectable()
export class StorageQuotaService {
  constructor(
    private readonly services: ServiceRepository,
    private readonly servers: ServerRepository,
  ) {}

  async summary(orgId: string, serverId: string): Promise<StorageSummary | null> {
    const server = await this.servers.findById(orgId, serverId);
    if (!server) return null;
    const allocated = await this.services.allocatedDiskGb(serverId);
    return StorageBudgetValidator.summarize(server.storageBudgetGb, allocated);
  }

  async explainShortfall(
    orgId: string,
    serverId: string,
    requestedGb: number,
    excludeServiceId?: string,
  ): Promise<string> {
    const server = await this.servers.findById(orgId, serverId);
    if (!server) return 'Target server not found';
    const allocatedOthers = await this.services.allocatedDiskGb(serverId, excludeServiceId);
    return (
      StorageBudgetValidator.shortfall(
        server.storageBudgetGb,
        allocatedOthers,
        requestedGb,
        server.name,
      ) ?? 'Not enough storage is left on this server.'
    );
  }
}
