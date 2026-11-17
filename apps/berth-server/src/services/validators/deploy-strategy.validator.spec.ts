import { describe, expect, it } from 'vitest';
import { DeployStrategyValidator } from './deploy-strategy.validator';

describe('DeployStrategyValidator', () => {
  it('lets rolling services scale and autoscale freely', () => {
    expect(
      DeployStrategyValidator.conflict({ strategy: 'rolling', replicas: 8, autoscaled: true }),
    ).toBeNull();
  });

  it('allows a single run-once instance', () => {
    expect(
      DeployStrategyValidator.conflict({ strategy: 'recreate', replicas: 1, autoscaled: false }),
    ).toBeNull();
  });

  it('refuses replicas on a run-once service', () => {
    expect(
      DeployStrategyValidator.conflict({ strategy: 'recreate', replicas: 2, autoscaled: false }),
    ).toContain('more than one replica');
  });

  it('refuses autoscaling on a run-once service', () => {
    expect(
      DeployStrategyValidator.conflict({ strategy: 'recreate', replicas: 1, autoscaled: true }),
    ).toContain('cannot be autoscaled');
  });

  it('treats a manual replica policy as not autoscaled', () => {
    expect(DeployStrategyValidator.isAutoscaled({ strategy: 'manual' })).toBe(false);
    expect(DeployStrategyValidator.isAutoscaled(undefined)).toBe(false);
    expect(DeployStrategyValidator.isAutoscaled({ strategy: 'cpu' })).toBe(true);
  });
});
