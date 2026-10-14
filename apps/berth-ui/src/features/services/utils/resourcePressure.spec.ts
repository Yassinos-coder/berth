import { describe, expect, it } from 'vitest';
import { ResourcePressure } from './resourcePressure';

describe('ResourcePressure', () => {
  it.each([
    [100, 1024, 'ok'],
    [900, 1024, 'high'],
    [1000, 1024, 'critical'],
  ])('classifies %i MB of %i MB as %s', (used, limit, level) => {
    expect(ResourcePressure.memory(used, limit).level).toBe(level);
  });

  it('scales CPU percent by the number of cores', () => {
    expect(ResourcePressure.cpu(100, 1).level).toBe('critical');
    expect(ResourcePressure.cpu(100, 2).level).toBe('ok');
    expect(ResourcePressure.cpu(180, 2).level).toBe('high');
  });

  it('never divides by zero', () => {
    expect(Number.isFinite(ResourcePressure.memory(10, 0).ratio)).toBe(true);
    expect(Number.isFinite(ResourcePressure.cpu(10, 0).ratio)).toBe(true);
  });

  it('reports nothing when both are fine', () => {
    expect(
      ResourcePressure.warning(ResourcePressure.memory(100, 1024), ResourcePressure.cpu(10, 1)),
    ).toBeNull();
  });

  it('puts the most urgent problem first', () => {
    const warning = ResourcePressure.warning(
      ResourcePressure.memory(1000, 1024),
      ResourcePressure.cpu(100, 1),
    );
    expect(warning).toContain('Memory');
    expect(warning).toContain('killed');
  });
});
