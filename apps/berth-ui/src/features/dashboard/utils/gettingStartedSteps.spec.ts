import { describe, expect, it } from 'vitest';
import { GettingStartedSteps } from '@/features/dashboard/utils/gettingStartedSteps';

const empty = { serversOnline: 0, githubConnected: false, serviceCount: 0, proxyHostCount: 0, channelCount: 0 };

describe('GettingStartedSteps', () => {
  it('starts with everything outstanding', () => {
    const steps = GettingStartedSteps.compute(empty);
    expect(steps).toHaveLength(5);
    expect(GettingStartedSteps.remaining(steps)).toHaveLength(5);
  });

  it('marks steps done from real counts', () => {
    const steps = GettingStartedSteps.compute({ ...empty, serversOnline: 1, serviceCount: 3 });
    const done = steps.filter((step) => step.done).map((step) => step.id);
    expect(done).toEqual(['server', 'service']);
  });

  it('is complete once every signal is present', () => {
    const steps = GettingStartedSteps.compute({
      serversOnline: 1,
      githubConnected: true,
      serviceCount: 1,
      proxyHostCount: 1,
      channelCount: 1,
    });
    expect(GettingStartedSteps.remaining(steps)).toEqual([]);
  });

  it('does not count an offline-only fleet as a connected server', () => {
    expect(GettingStartedSteps.compute(empty)[0].done).toBe(false);
  });

  it('links every step somewhere', () => {
    for (const step of GettingStartedSteps.compute(empty)) expect(step.to.startsWith('/')).toBe(true);
  });
});
