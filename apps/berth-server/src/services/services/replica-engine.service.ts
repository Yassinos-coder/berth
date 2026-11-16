import { Injectable } from '@nestjs/common';
import type { ReplicaPolicy, ReplicaScalePlan } from '@berth/protocol';
import { ReplicaPolicyValidator } from '../validators/replica-policy.validator';

export interface ReplicaScaleSnapshot {
  cpuPct: number;
  memMb: number;
  memoryLimitMb: number;
}

@Injectable()
export class ReplicaEngineService {
  normalizePolicy(policy?: Partial<ReplicaPolicy>): ReplicaPolicy {
    return ReplicaPolicyValidator.normalize(policy);
  }

  planScale(
    serviceId: string,
    currentReplicas: number,
    snapshot: ReplicaScaleSnapshot,
    policy?: Partial<ReplicaPolicy>,
  ): ReplicaScalePlan {
    const activePolicy = this.normalizePolicy(policy);
    const minReplicas = Math.max(1, activePolicy.minReplicas ?? 1);
    const maxReplicas = Math.max(minReplicas, activePolicy.maxReplicas ?? currentReplicas);

    if (activePolicy.strategy === 'manual') {
      return {
        serviceId,
        currentReplicas,
        desiredReplicas: clamp(currentReplicas, minReplicas, maxReplicas),
        reason: 'Manual scaling is enabled; no automatic replica changes were applied.',
        strategy: 'manual',
        changed: false,
      };
    }

    const cpuPressure = snapshot.memoryLimitMb > 0 ? snapshot.cpuPct / Math.max(activePolicy.targetCpuPct, 1) : 1;
    const memoryPressure = snapshot.memoryLimitMb > 0
      ? (snapshot.memMb / Math.max(snapshot.memoryLimitMb, 1)) * 100 / Math.max(activePolicy.targetMemoryPct, 1)
      : 1;

    const cpuFactor = Math.max(0.5, Math.min(2, cpuPressure));
    const memoryFactor = Math.max(0.5, Math.min(2, memoryPressure));

    const targetFactor = this.selectScaleFactor(activePolicy.strategy, cpuFactor, memoryFactor);
    const desiredReplicas = clamp(
      Math.ceil(currentReplicas * targetFactor),
      minReplicas,
      maxReplicas,
    );

    const reason = this.describeReason(activePolicy.strategy, {
      currentReplicas,
      desiredReplicas,
      cpuPressure,
      memoryPressure,
      cpuPct: snapshot.cpuPct,
      memoryPct: snapshot.memoryLimitMb > 0 ? (snapshot.memMb / snapshot.memoryLimitMb) * 100 : 0,
    });

    return {
      serviceId,
      currentReplicas,
      desiredReplicas,
      reason,
      strategy: activePolicy.strategy,
      changed: desiredReplicas !== currentReplicas,
    };
  }

  private selectScaleFactor(
    strategy: ReplicaPolicy['strategy'],
    cpuFactor: number,
    memoryFactor: number,
  ): number {
    if (strategy === 'cpu') return cpuFactor;
    if (strategy === 'memory') return memoryFactor;
    if (strategy === 'balanced') return Math.max(cpuFactor, memoryFactor);
    return 1;
  }

  private describeReason(
    strategy: ReplicaPolicy['strategy'],
    details: {
      currentReplicas: number;
      desiredReplicas: number;
      cpuPressure: number;
      memoryPressure: number;
      cpuPct: number;
      memoryPct: number;
    },
  ): string {
    if (details.desiredReplicas === details.currentReplicas) {
      return `${strategy} scaling is stable: ${details.cpuPct}% CPU and ${details.memoryPct.toFixed(0)}% memory utilization remain within policy.`;
    }
    if (strategy === 'cpu') {
      return `CPU pressure reached ${details.cpuPressure.toFixed(2)}x target; scaling from ${details.currentReplicas} to ${details.desiredReplicas} replicas.`;
    }
    if (strategy === 'memory') {
      return `Memory pressure reached ${details.memoryPressure.toFixed(2)}x target; scaling from ${details.currentReplicas} to ${details.desiredReplicas} replicas.`;
    }
    return `Combined pressure reached ${details.cpuPressure.toFixed(2)}x CPU and ${details.memoryPressure.toFixed(2)}x memory targets; scaling from ${details.currentReplicas} to ${details.desiredReplicas} replicas.`;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(Math.round(value), min), max);
}
