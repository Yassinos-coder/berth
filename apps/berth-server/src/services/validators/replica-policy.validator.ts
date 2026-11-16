import { Prisma } from '@prisma/client';
import type { ReplicaPolicy } from '@berth/protocol';

const DEFAULT_POLICY: ReplicaPolicy = {
  minReplicas: 1,
  maxReplicas: 4,
  targetCpuPct: 70,
  targetMemoryPct: 70,
  strategy: 'balanced',
  cooldownSeconds: 60,
};

const MAX_REPLICAS = 32;

export class ReplicaPolicyValidator {
  static toJson(policy: ReplicaPolicy): Prisma.InputJsonObject {
    return {
      minReplicas: policy.minReplicas,
      maxReplicas: policy.maxReplicas,
      targetCpuPct: policy.targetCpuPct,
      targetMemoryPct: policy.targetMemoryPct,
      strategy: policy.strategy,
      cooldownSeconds: policy.cooldownSeconds,
    };
  }

  static normalize(policy?: Partial<ReplicaPolicy>): ReplicaPolicy {
    const minReplicas = clampInteger(policy?.minReplicas, 1, MAX_REPLICAS, 1);
    const maxReplicas = Math.max(
      minReplicas,
      clampInteger(policy?.maxReplicas, 1, MAX_REPLICAS, DEFAULT_POLICY.maxReplicas),
    );
    return {
      minReplicas,
      maxReplicas,
      targetCpuPct: clampNumber(
        policy?.targetCpuPct,
        10,
        100,
        DEFAULT_POLICY.targetCpuPct,
      ),
      targetMemoryPct: clampNumber(
        policy?.targetMemoryPct,
        10,
        100,
        DEFAULT_POLICY.targetMemoryPct,
      ),
      strategy: isStrategy(policy?.strategy)
        ? policy.strategy
        : DEFAULT_POLICY.strategy,
      cooldownSeconds: Math.max(
        30,
        Math.round(policy?.cooldownSeconds ?? DEFAULT_POLICY.cooldownSeconds),
      ),
    };
  }

  static fromStored(value: unknown): ReplicaPolicy | undefined {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return undefined;
    }
    const stored = value as Record<string, unknown>;

    return ReplicaPolicyValidator.normalize({
      minReplicas: readNumber(stored.minReplicas),
      maxReplicas: readNumber(stored.maxReplicas),
      targetCpuPct: readNumber(stored.targetCpuPct),
      targetMemoryPct: readNumber(stored.targetMemoryPct),
      strategy: isStrategy(stored.strategy) ? stored.strategy : undefined,
      cooldownSeconds: readNumber(stored.cooldownSeconds),
    });
  }
}

function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

function isStrategy(value: unknown): value is ReplicaPolicy['strategy'] {
  return (
    value === 'manual' ||
    value === 'cpu' ||
    value === 'memory' ||
    value === 'balanced'
  );
}

function clampInteger(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  return Math.min(Math.max(Math.round(value ?? fallback), min), max);
}

function clampNumber(
  value: number | undefined,
  min: number,
  max: number,
  fallback: number,
): number {
  return Math.min(Math.max(value ?? fallback, min), max);
}
