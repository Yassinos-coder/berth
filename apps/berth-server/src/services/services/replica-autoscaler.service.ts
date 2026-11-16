import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ActivityKind } from '@prisma/client';
import { AgentRegistry } from '../../agent-gateway/registry/agent-registry.service';
import { ActivityService } from '../../activity/activity.service';
import { ServiceRepository } from '../repositories/service.repository';
import { ReplicaPolicyValidator } from '../validators/replica-policy.validator';
import { ReplicaEngineService } from './replica-engine.service';

const EVALUATION_INTERVAL_MS = 60_000;
const METRIC_WINDOW_MS = 5 * 60_000;
const METRIC_MAX_AGE_MS = 2 * 60_000;
const MINIMUM_SAMPLES = 2;

@Injectable()
export class ReplicaAutoscalerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ReplicaAutoscalerService.name);
  private readonly capacityWarnings = new Set<string>();
  private timer?: NodeJS.Timeout;
  private evaluating = false;

  constructor(
    private readonly repository: ServiceRepository,
    private readonly replicaEngine: ReplicaEngineService,
    private readonly registry: AgentRegistry,
    private readonly activity: ActivityService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.evaluate(), EVALUATION_INTERVAL_MS);
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async evaluate(now = Date.now()): Promise<void> {
    if (this.evaluating) return;
    this.evaluating = true;
    try {
      await this.evaluateServices(now);
    } catch (error) {
      this.logger.error(`replica evaluation failed: ${error}`);
    } finally {
      this.evaluating = false;
    }
  }

  private async evaluateServices(now: number): Promise<void> {
    const candidates = await this.repository.autoscalingCandidates();
    const eligible = candidates.filter((service) => {
      const policy = ReplicaPolicyValidator.fromStored(service.replicaPolicy);
      return (
        policy !== undefined &&
        policy.strategy !== 'manual' &&
        !service.volumePath &&
        !(service.publicNetworking && service.containerPort !== null)
      );
    });
    if (eligible.length === 0) return;

    const samples = await this.repository.metricAggregates(
      eligible.map((service) => service.id),
      new Date(now - METRIC_WINDOW_MS),
    );
    const sampleByService = new Map(
      samples.map((sample) => [sample.serviceId, sample] as const),
    );
    const changedServerIds = new Set<string>();

    for (const service of eligible) {
      const policy = ReplicaPolicyValidator.fromStored(service.replicaPolicy);
      const sample = sampleByService.get(service.id);
      const latestSampleAt = sample?._max.ts?.getTime();
      if (
        !policy ||
        !sample ||
        sample._count._all < MINIMUM_SAMPLES ||
        !latestSampleAt ||
        now - latestSampleAt > METRIC_MAX_AGE_MS ||
        sample._avg.cpuPct === null ||
        sample._avg.memMb === null ||
        (service.lastReplicaScaleAt &&
          now - service.lastReplicaScaleAt.getTime() <
            policy.cooldownSeconds * 1000)
      ) {
        continue;
      }

      const plan = this.replicaEngine.planScale(
        service.id,
        service.replicas,
        {
          cpuPct: sample._avg.cpuPct,
          memMb: sample._avg.memMb,
          memoryLimitMb: service.memoryMb,
        },
        policy,
      );
      if (!plan.changed) continue;

      try {
        const claim = await this.repository.claimReplicaScale({
          serviceId: service.id,
          serverId: service.serverId,
          currentReplicas: service.replicas,
          lastReplicaScaleAt: service.lastReplicaScaleAt,
          nextReplicas: plan.desiredReplicas,
          scaledAt: new Date(now),
        });
        if (claim === 'capacity') {
          if (!this.capacityWarnings.has(service.id)) {
            this.logger.warn(
              `replica scale-up for ${service.name} exceeds server CPU or memory capacity`,
            );
            this.capacityWarnings.add(service.id);
          }
          continue;
        }
        this.capacityWarnings.delete(service.id);
        if (claim !== 'claimed') continue;

        changedServerIds.add(service.serverId);
        await this.activity.record(service.orgId, {
          kind: ActivityKind.system,
          title: `${service.name} autoscaled`,
          detail: plan.reason,
          actor: 'system',
        });
      } catch (error) {
        this.logger.error(`replica scaling failed for ${service.id}: ${error}`);
      }
    }

    for (const serverId of changedServerIds) {
      try {
        await this.registry.reconcileServer(serverId);
      } catch (error) {
        this.logger.error(`replica reconcile failed for server ${serverId}: ${error}`);
      }
    }
  }
}
