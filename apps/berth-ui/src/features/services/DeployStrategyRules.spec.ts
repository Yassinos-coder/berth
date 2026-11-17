import { describe, expect, it } from 'vitest';
import { DeployStrategyRules } from './DeployStrategySettings';

describe('DeployStrategyRules', () => {
  it('allows run-once on a single, manually scaled service', () => {
    expect(DeployStrategyRules.blockedReason({ replicas: 1 })).toBeNull();
    expect(
      DeployStrategyRules.blockedReason({
        replicas: 1,
        replicaPolicy: { strategy: 'manual' } as never,
      }),
    ).toBeNull();
  });

  it('explains that replicas must be one first', () => {
    expect(DeployStrategyRules.blockedReason({ replicas: 3 })).toContain('replicas to 1');
  });

  it('explains that autoscaling must be off first', () => {
    expect(
      DeployStrategyRules.blockedReason({
        replicas: 1,
        replicaPolicy: { strategy: 'cpu' } as never,
      }),
    ).toContain('autoscaling');
  });
});
