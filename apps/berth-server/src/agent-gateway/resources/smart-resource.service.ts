import { Injectable, Logger } from '@nestjs/common';
import { ActivityKind, ServiceState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AgentRegistry } from '../registry/agent-registry.service';

const EVALUATION_INTERVAL_MS = 12_000;
const HIGH_WATERMARK = 0.9;
const SUSTAINED_SAMPLES = 3;
const MEMORY_STEP_MB = 100;
const SCALE_COOLDOWN_MS = 5 * 60_000;
const HOST_RESERVE_MB = 256;

interface WatchState {
  highSamples: number;
  lastEvaluatedAt: number;
  lastScaledAt: number;
}

@Injectable()
export class SmartResourceService {
  private readonly logger = new Logger(SmartResourceService.name);
  private readonly watches = new Map<string, WatchState>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: AgentRegistry,
  ) {}

  async observe(serviceId: string, memoryUsedMb: number): Promise<void> {
    const now = Date.now();
    const watch = this.watches.get(serviceId) ?? {
      highSamples: 0,
      lastEvaluatedAt: 0,
      lastScaledAt: 0,
    };
    if (now - watch.lastEvaluatedAt < EVALUATION_INTERVAL_MS) return;
    watch.lastEvaluatedAt = now;
    this.watches.set(serviceId, watch);

    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: {
        id: true,
        name: true,
        orgId: true,
        serverId: true,
        state: true,
        memoryMb: true,
        org: { select: { smartResourcesEnabled: true } },
        server: { select: { memoryMb: true } },
      },
    });
    if (
      !service
      || !service.org.smartResourcesEnabled
      || service.state !== ServiceState.running
    ) {
      this.watches.delete(serviceId);
      return;
    }

    const pressure = memoryUsedMb / Math.max(service.memoryMb, 1);
    watch.highSamples = pressure >= HIGH_WATERMARK ? watch.highSamples + 1 : 0;
    if (
      watch.highSamples < SUSTAINED_SAMPLES
      || now - watch.lastScaledAt < SCALE_COOLDOWN_MS
    ) return;

    const allocated = await this.prisma.service.aggregate({
      where: {
        serverId: service.serverId,
        id: { not: service.id },
        state: { not: ServiceState.stopped },
      },
      _sum: { memoryMb: true },
    });
    const hostCapacity = Math.max(0, service.server.memoryMb - HOST_RESERVE_MB);
    const availableForService = Math.max(
      service.memoryMb,
      hostCapacity - (allocated._sum.memoryMb ?? 0),
    );
    const nextMemoryMb = Math.min(
      service.memoryMb + MEMORY_STEP_MB,
      availableForService,
    );
    watch.highSamples = 0;
    watch.lastScaledAt = now;

    if (nextMemoryMb <= service.memoryMb) {
      this.logger.warn(
        `${service.name} reached its memory ceiling, but ${service.serverId} has no safe capacity left`,
      );
      return;
    }

    const updated = await this.prisma.service.updateMany({
      where: { id: service.id, memoryMb: service.memoryMb },
      data: { memoryMb: nextMemoryMb },
    });
    if (updated.count === 0) return;

    await this.prisma.activity.create({
      data: {
        orgId: service.orgId,
        kind: ActivityKind.system,
        title: `Smart resources increased ${service.name}`,
        detail: `${Math.round(memoryUsedMb)} MB used at a ${service.memoryMb} MB limit; raised to ${nextMemoryMb} MB.`,
        actor: 'smart-resources',
      },
    });
    this.logger.log(
      `${service.name}: memory limit ${service.memoryMb} MB -> ${nextMemoryMb} MB`,
    );
    await this.registry.reconcileForService(service.id);
  }
}
