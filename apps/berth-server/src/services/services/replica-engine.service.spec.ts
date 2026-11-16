import { describe, expect, it } from 'vitest';
import { ReplicaEngineService } from './replica-engine.service';

describe('ReplicaEngineService', () => {
  it('scales up when cpu pressure crosses the target threshold', () => {
    const engine = new ReplicaEngineService();

    const plan = engine.planScale('svc-1', 1, {
      cpuPct: 90,
      memMb: 600,
      memoryLimitMb: 1000,
    });

    expect(plan.changed).toBe(true);
    expect(plan.desiredReplicas).toBeGreaterThan(plan.currentReplicas);
    expect(plan.strategy).toBe('balanced');
  });

  it('preserves the current replica count in manual mode', () => {
    const engine = new ReplicaEngineService();

    const plan = engine.planScale(
      'svc-2',
      2,
      {
        cpuPct: 90,
        memMb: 800,
        memoryLimitMb: 1000,
      },
      {
        strategy: 'manual',
        minReplicas: 1,
        maxReplicas: 6,
        targetCpuPct: 70,
        targetMemoryPct: 70,
        cooldownSeconds: 60,
      },
    );

    expect(plan.changed).toBe(false);
    expect(plan.desiredReplicas).toBe(2);
  });

  it('honors the configured minimum and maximum scale bounds', () => {
    const engine = new ReplicaEngineService();

    const plan = engine.planScale(
      'svc-3',
      1,
      {
        cpuPct: 5,
        memMb: 10,
        memoryLimitMb: 1000,
      },
      {
        minReplicas: 2,
        maxReplicas: 3,
        targetCpuPct: 70,
        targetMemoryPct: 70,
        strategy: 'balanced',
        cooldownSeconds: 60,
      },
    );

    expect(plan.desiredReplicas).toBe(2);
  });
});
