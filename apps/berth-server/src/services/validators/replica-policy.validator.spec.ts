import { describe, expect, it } from 'vitest';
import { ReplicaPolicyValidator } from './replica-policy.validator';

describe('ReplicaPolicyValidator', () => {
  it('round-trips normalized policy through Prisma JSON', () => {
    const policy = ReplicaPolicyValidator.normalize({
      minReplicas: 2,
      maxReplicas: 8,
      targetCpuPct: 65,
      targetMemoryPct: 75,
      strategy: 'cpu',
      cooldownSeconds: 90,
    });

    const stored = ReplicaPolicyValidator.toJson(policy);

    expect(ReplicaPolicyValidator.fromStored(stored)).toEqual(policy);
  });

  it('ignores malformed stored policies', () => {
    expect(ReplicaPolicyValidator.fromStored(['not', 'a', 'policy'])).toBeUndefined();
    expect(ReplicaPolicyValidator.fromStored(null)).toBeUndefined();
  });

  it('keeps normalized replica bounds within the agent limit', () => {
    expect(
      ReplicaPolicyValidator.normalize({
        minReplicas: 40,
        maxReplicas: 2,
      }),
    ).toMatchObject({ minReplicas: 32, maxReplicas: 32 });
  });
});
