import { describe, expect, it } from 'vitest';
import { TrafficRules } from '@/features/services/trafficRules';

describe('TrafficRules', () => {
  it('only judges health once there is enough traffic to mean something', () => {
    expect(TrafficRules.health(100, 5)).toBe('ok');
    expect(TrafficRules.health(0.5, 500)).toBe('ok');
    expect(TrafficRules.health(1, 500)).toBe('warning');
    expect(TrafficRules.health(5, 500)).toBe('critical');
  });

  it('formats counts and latency compactly', () => {
    expect(TrafficRules.count(999)).toBe('999');
    expect(TrafficRules.count(1500)).toBe('1.5k');
    expect(TrafficRules.count(25_000)).toBe('25k');
    expect(TrafficRules.count(2_300_000)).toBe('2.3M');
    expect(TrafficRules.latency(240)).toBe('240 ms');
    expect(TrafficRules.latency(1800)).toBe('1.8 s');
  });
});
