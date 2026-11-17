import { Injectable } from '@nestjs/common';
import {
  Builder,
  DeployStrategy,
  EnvVar,
  Prisma,
  Server,
  Service,
  ServiceKind,
  ServiceState,
  SourceKind,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { StorageBudgetValidator } from '../../common/validators/storage-budget.validator';
import type {
  ReplicaScaleClaimInput,
  ReplicaScaleClaimResult,
} from '../interfaces/replica-autoscaler.interface';
import type { ServiceMutationResult } from '../interfaces/service-mutation.interface';

type ServiceWithServer = Service & {
  server: Pick<Server, 'name'>;
  environment: { name: string } | null;
};

const withServer = {
  server: { select: { name: true } },
  environment: { select: { name: true } },
} satisfies Prisma.ServiceInclude;

@Injectable()
export class ServiceRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<ServiceWithServer[]> {
    return this.prisma.service.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: withServer,
    });
  }

  async environmentExists(orgId: string, id: string): Promise<boolean> {
    const count = await this.prisma.environment.count({ where: { id, orgId } });
    return count > 0;
  }

  findById(orgId: string, id: string): Promise<ServiceWithServer | null> {
    return this.prisma.service.findFirst({
      where: { id, orgId },
      include: withServer,
    });
  }

  findWithConnection(orgId: string, id: string) {
    return this.prisma.service.findFirst({
      where: { id, orgId },
      include: {
        envVars: true,
        server: { select: { name: true, ip: true } },
      },
    });
  }

  moveToServer(
    orgId: string,
    id: string,
    targetServerId: string,
  ): Promise<ServiceMutationResult<ServiceWithServer>> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockServerCapacity(transaction, targetServerId);
      const service = await transaction.service.findFirst({ where: { id, orgId } });
      if (!service) return { status: 'not-found' };

      if (
        !(await this.hasCapacity(transaction, targetServerId, {
          cpuCores: service.cpuCores,
          memoryMb: service.memoryMb,
          replicas: service.replicas,
        }))
      ) {
        return { status: 'capacity' };
      }
      if (
        service.volumePath &&
        service.diskGb &&
        !(await this.storageFits(transaction, targetServerId, service.diskGb))
      ) {
        return { status: 'storage' };
      }

      const moved = await transaction.service.update({
        where: { id },
        data: { serverId: targetServerId, state: ServiceState.starting, specHash: null },
        include: withServer,
      });
      return { status: 'saved', value: moved };
    });
  }

  create(data: {
    orgId: string;
    serverId: string;
    name: string;
    kind: ServiceKind;
    sourceKind: SourceKind;
    image?: string;
    tag?: string;
    repo?: string;
    branch?: string;
    builder?: Builder;
    dockerfilePath?: string;
    rootDirectory?: string;
    buildCommand?: string;
    startCommand?: string;
    cpuCores: number;
    memoryMb: number;
    cpuShares?: number;
    diskGb?: number;
    replicas?: number;
    replicaPolicy?: Prisma.InputJsonValue;
    deployStrategy?: DeployStrategy;
    volumeLimited?: boolean;
    domain?: string;
    templateKind?: string;
    containerPort?: number;
    publicNetworking?: boolean;
    volumeName?: string;
    volumePath?: string;
    internalDomains?: string[];
    command?: string[];
    environmentId?: string;
    env?: { key: string; value: string; isSecret: boolean }[];
  }): Promise<ServiceMutationResult<ServiceWithServer>> {
    const { env, ...fields } = data;
    return this.prisma.$transaction(async (transaction) => {
      await this.lockServerCapacity(transaction, fields.serverId);
      const replicas = fields.replicas ?? 1;
      if (
        !(await this.hasCapacity(transaction, fields.serverId, {
          cpuCores: fields.cpuCores,
          memoryMb: fields.memoryMb,
          replicas,
        }))
      ) {
        return { status: 'capacity' };
      }

      if (
        fields.volumePath &&
        fields.diskGb &&
        !(await this.storageFits(transaction, fields.serverId, fields.diskGb))
      ) {
        return { status: 'storage' };
      }

      const service = await transaction.service.create({
        data: {
          ...fields,
          replicas,
          state: ServiceState.starting,
          lastDeployedAt: new Date(),
          envVars:
            env && env.length > 0
              ? {
                  create: env.map((item) => ({
                    key: item.key,
                    value: item.value,
                    isSecret: item.isSecret,
                  })),
                }
              : undefined,
        },
        include: withServer,
      });
      return { status: 'saved', value: service };
    });
  }

  async updateBuildConfig(
    orgId: string,
    id: string,
    data: {
      name?: string;
      rootDirectory?: string | null;
      buildCommand?: string | null;
      startCommand?: string | null;
      dockerfilePath?: string | null;
      builder?: Builder;
      registryCredentialId?: string | null;
      targetPlatform?: string | null;
      releaseCommand?: string | null;
      previewsEnabled?: boolean;
      alertsMuted?: boolean;
      replicas?: number;
      replicaPolicy?: Prisma.InputJsonValue;
      deployStrategy?: DeployStrategy;
      autoRollback?: boolean;
      cpuCores?: number;
      memoryMb?: number;
      cpuShares?: number;
      volumeName?: string;
      volumePath?: string | null;
      diskGb?: number;
      volumeLimited?: boolean;
    },
  ): Promise<ServiceMutationResult<ServiceWithServer>> {
    return this.prisma.$transaction(async (transaction) => {
      let existing:
        | Pick<
            Service,
            | 'serverId'
            | 'replicas'
            | 'cpuCores'
            | 'memoryMb'
            | 'state'
            | 'lastReplicaScaleAt'
          >
        | null = null;
      const changesCapacity =
        data.replicas !== undefined ||
        data.cpuCores !== undefined ||
        data.memoryMb !== undefined;
      if (changesCapacity) {
        const serviceServer = await transaction.service.findFirst({
          where: { id, orgId },
          select: { serverId: true },
        });
        if (!serviceServer) return { status: 'not-found' };
        await this.lockServerCapacity(transaction, serviceServer.serverId);
        existing = await transaction.service.findFirst({
          where: { id, orgId },
          select: {
            serverId: true,
            replicas: true,
            cpuCores: true,
            memoryMb: true,
            state: true,
            lastReplicaScaleAt: true,
          },
        });
        if (!existing) return { status: 'not-found' };
        const nextCpuCores = data.cpuCores ?? existing.cpuCores;
        const nextMemoryMb = data.memoryMb ?? existing.memoryMb;
        const nextReplicas = data.replicas ?? existing.replicas;
        const increasesCpu =
          nextCpuCores * nextReplicas >
          existing.cpuCores * existing.replicas;
        const increasesMemory =
          nextMemoryMb * nextReplicas >
          existing.memoryMb * existing.replicas;
        if (
          (increasesCpu || increasesMemory) &&
          existing.state !== ServiceState.stopped &&
          !(await this.hasCapacity(
            transaction,
            existing.serverId,
            {
              cpuCores: nextCpuCores,
              memoryMb: nextMemoryMb,
              replicas: nextReplicas,
            },
            id,
          ))
        ) {
          return { status: 'capacity' };
        }
      }

      if (data.diskGb !== undefined || data.volumePath !== undefined) {
        const current = await transaction.service.findFirst({
          where: { id, orgId },
          select: { serverId: true, diskGb: true, volumePath: true },
        });
        if (!current) return { status: 'not-found' };
        const nextPath =
          data.volumePath === undefined ? current.volumePath : data.volumePath;
        const nextDisk = data.diskGb ?? current.diskGb;
        const currentDisk = current.volumePath ? (current.diskGb ?? 0) : 0;
        if (
          nextPath &&
          nextDisk &&
          nextDisk > currentDisk &&
          !(await this.storageFits(transaction, current.serverId, nextDisk, id))
        ) {
          return { status: 'storage' };
        }
      }

      const result = await transaction.service.updateMany({
        where: {
          id,
          orgId,
          ...(existing
            ? {
                replicas: existing.replicas,
                lastReplicaScaleAt: existing.lastReplicaScaleAt,
              }
            : {}),
        },
        data: {
          ...data,
          ...(data.replicaPolicy !== undefined || changesCapacity
            ? { lastReplicaScaleAt: new Date() }
            : {}),
        },
      });
      if (result.count === 0) return { status: 'not-found' };
      const service = await transaction.service.findFirst({
        where: { id, orgId },
        include: withServer,
      });
      if (!service) return { status: 'not-found' };
      return { status: 'saved', value: service };
    });
  }

  async updateInternalDomains(
    orgId: string,
    id: string,
    internalDomains: string[],
  ): Promise<ServiceWithServer | null> {
    const result = await this.prisma.service.updateMany({
      where: { id, orgId },
      data: { internalDomains },
    });
    if (result.count === 0) return null;
    return this.findById(orgId, id);
  }

  updateStateWithCapacity(
    orgId: string,
    id: string,
    state: ServiceState,
  ): Promise<ServiceMutationResult<true>> {
    return this.prisma.$transaction(async (transaction) => {
      const serviceServer = await transaction.service.findFirst({
        where: { id, orgId },
        select: { serverId: true },
      });
      if (!serviceServer) return { status: 'not-found' };
      await this.lockServerCapacity(transaction, serviceServer.serverId);
      const existing = await transaction.service.findFirst({
        where: { id, orgId },
        select: {
          serverId: true,
          replicas: true,
          cpuCores: true,
          memoryMb: true,
          state: true,
        },
      });
      if (!existing) return { status: 'not-found' };
      if (
        existing.state === ServiceState.stopped &&
        state !== ServiceState.stopped &&
        !(await this.hasCapacity(
          transaction,
          existing.serverId,
          {
            cpuCores: existing.cpuCores,
            memoryMb: existing.memoryMb,
            replicas: existing.replicas,
          },
          id,
        ))
      ) {
        return { status: 'capacity' };
      }

      const result = await transaction.service.updateMany({
        where: { id, orgId, state: existing.state },
        data: { state, lastDeployedAt: new Date() },
      });
      if (result.count === 0) return { status: 'not-found' };
      return { status: 'saved', value: true };
    });
  }

  async updateReplicas(
    orgId: string,
    id: string,
    replicas: number,
    replicaPolicy?: Prisma.InputJsonValue,
  ): Promise<ServiceMutationResult<ServiceWithServer>> {
    return this.prisma.$transaction(async (transaction) => {
      const serviceServer = await transaction.service.findFirst({
        where: { id, orgId },
        select: { serverId: true },
      });
      if (!serviceServer) return { status: 'not-found' };
      await this.lockServerCapacity(transaction, serviceServer.serverId);
      const existing = await transaction.service.findFirst({
        where: { id, orgId },
        select: {
          serverId: true,
          replicas: true,
          cpuCores: true,
          memoryMb: true,
          state: true,
          lastReplicaScaleAt: true,
        },
      });
      if (!existing) return { status: 'not-found' };
      if (
        replicas > existing.replicas &&
        existing.state !== ServiceState.stopped &&
        !(await this.hasCapacity(
          transaction,
          existing.serverId,
          {
            cpuCores: existing.cpuCores,
            memoryMb: existing.memoryMb,
            replicas,
          },
          id,
        ))
      ) {
        return { status: 'capacity' };
      }

      const result = await transaction.service.updateMany({
        where: {
          id,
          orgId,
          replicas: existing.replicas,
          lastReplicaScaleAt: existing.lastReplicaScaleAt,
        },
        data: { replicas, replicaPolicy, lastReplicaScaleAt: new Date() },
      });
      if (result.count === 0) return { status: 'not-found' };
      const service = await transaction.service.findFirst({
        where: { id, orgId },
        include: withServer,
      });
      if (!service) return { status: 'not-found' };
      return { status: 'saved', value: service };
    });
  }

  autoscalingCandidates() {
    return this.prisma.service.findMany({
      where: {
        state: ServiceState.running,
        replicaPolicy: { not: Prisma.DbNull },
        deployStrategy: DeployStrategy.rolling,
      },
      select: {
        id: true,
        orgId: true,
        serverId: true,
        name: true,
        replicas: true,
        memoryMb: true,
        replicaPolicy: true,
        lastReplicaScaleAt: true,
        publicNetworking: true,
        containerPort: true,
        volumePath: true,
      },
    });
  }

  metricAggregates(serviceIds: string[], since: Date) {
    if (serviceIds.length === 0) return Promise.resolve([]);
    return this.prisma.metricSample.groupBy({
      by: ['serviceId'],
      where: { serviceId: { in: serviceIds }, ts: { gte: since } },
      _avg: { cpuPct: true, memMb: true },
      _max: { ts: true },
      _count: { _all: true },
    });
  }

  claimReplicaScale(
    input: ReplicaScaleClaimInput,
  ): Promise<ReplicaScaleClaimResult> {
    return this.prisma.$transaction(async (transaction) => {
      await this.lockServerCapacity(transaction, input.serverId);
      const service = await transaction.service.findFirst({
        where: { id: input.serviceId, serverId: input.serverId },
        select: {
          replicas: true,
          cpuCores: true,
          memoryMb: true,
          state: true,
        },
      });
      if (!service || service.replicas !== input.currentReplicas) {
        return 'conflict';
      }

      if (
        input.nextReplicas > input.currentReplicas &&
        service.state !== ServiceState.stopped
      ) {
        if (
          !(await this.hasCapacity(
            transaction,
            input.serverId,
            {
              cpuCores: service.cpuCores,
              memoryMb: service.memoryMb,
              replicas: input.nextReplicas,
            },
            input.serviceId,
          ))
        ) {
          return 'capacity';
        }
      }

      const result = await transaction.service.updateMany({
        where: {
          id: input.serviceId,
          replicas: input.currentReplicas,
          lastReplicaScaleAt: input.lastReplicaScaleAt,
        },
        data: {
          replicas: input.nextReplicas,
          lastReplicaScaleAt: input.scaledAt,
        },
      });
      return result.count === 1 ? 'claimed' : 'conflict';
    });
  }

  listEnv(serviceId: string): Promise<EnvVar[]> {
    return this.prisma.envVar.findMany({
      where: { serviceId },
      orderBy: { key: 'asc' },
    });
  }

  async replaceEnv(
    serviceId: string,
    env: { key: string; value: string; isSecret: boolean }[],
  ): Promise<void> {
    await this.prisma.$transaction([
      this.prisma.envVar.deleteMany({ where: { serviceId } }),
      ...(env.length > 0
        ? [
            this.prisma.envVar.createMany({
              data: env.map((item) => ({ serviceId, ...item })),
            }),
          ]
        : []),
    ]);
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const result = await this.prisma.service.deleteMany({
      where: { id, orgId },
    });
    return result.count > 0;
  }

  private async lockServerCapacity(
    transaction: Prisma.TransactionClient,
    serverId: string,
  ): Promise<void> {
    await transaction.$executeRaw`
      SELECT pg_advisory_xact_lock(
        hashtext('berth-autoscale'),
        hashtext(${serverId})
      )
    `;
  }

  async allocatedDiskGb(serverId: string, excludeServiceId?: string): Promise<number> {
    return this.sumAllocatedDisk(this.prisma, serverId, excludeServiceId);
  }

  private async sumAllocatedDisk(
    client: Prisma.TransactionClient | PrismaService,
    serverId: string,
    excludeServiceId?: string,
  ): Promise<number> {
    const result = await client.service.aggregate({
      _sum: { diskGb: true },
      where: {
        serverId,
        volumePath: { not: null },
        diskGb: { not: null },
        ...(excludeServiceId ? { id: { not: excludeServiceId } } : {}),
      },
    });
    return result._sum.diskGb ?? 0;
  }

  private async storageFits(
    transaction: Prisma.TransactionClient,
    serverId: string,
    requestedGb: number,
    excludeServiceId?: string,
  ): Promise<boolean> {
    const server = await transaction.server.findUnique({
      where: { id: serverId },
      select: { storageBudgetGb: true },
    });
    if (!server || server.storageBudgetGb === null) return true;
    const allocated = await this.sumAllocatedDisk(transaction, serverId, excludeServiceId);
    const summary = StorageBudgetValidator.summarize(server.storageBudgetGb, allocated);
    return requestedGb <= (summary.freeGb ?? 0);
  }

  private async hasCapacity(
    transaction: Prisma.TransactionClient,
    serverId: string,
    requested: { cpuCores: number; memoryMb: number; replicas: number },
    excludeServiceId?: string,
  ): Promise<boolean> {
    const [server, services] = await Promise.all([
      transaction.server.findUnique({
        where: { id: serverId },
        select: { cpuCores: true, memoryMb: true },
      }),
      transaction.service.findMany({
        where: {
          serverId,
          state: { not: ServiceState.stopped },
          ...(excludeServiceId ? { id: { not: excludeServiceId } } : {}),
        },
        select: { replicas: true, cpuCores: true, memoryMb: true },
      }),
    ]);
    if (!server) return false;

    const cpuAllocated = services.reduce(
      (total, item) => total + item.cpuCores * item.replicas,
      0,
    );
    const memoryAllocated = services.reduce(
      (total, item) => total + item.memoryMb * item.replicas,
      0,
    );
    return (
      cpuAllocated + requested.cpuCores * requested.replicas <=
        server.cpuCores &&
      memoryAllocated + requested.memoryMb * requested.replicas <=
        server.memoryMb
    );
  }
}
