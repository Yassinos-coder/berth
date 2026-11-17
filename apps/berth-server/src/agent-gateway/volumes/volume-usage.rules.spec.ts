import { describe, expect, it } from 'vitest';
import { VOLUME_ALERT_COOLDOWN_MS, VolumeUsageRules } from './volume-usage.rules';

describe('VolumeUsageRules', () => {
  it('computes a bounded percentage', () => {
    expect(VolumeUsageRules.percent(512, 1024)).toBe(50);
    expect(VolumeUsageRules.percent(2000, 1024)).toBe(100);
    expect(VolumeUsageRules.percent(5, 0)).toBe(0);
  });

  it('alerts from 90 percent and then waits out the cooldown', () => {
    expect(VolumeUsageRules.shouldAlert(89, undefined, 0)).toBe(false);
    expect(VolumeUsageRules.shouldAlert(90, undefined, 0)).toBe(true);
    expect(VolumeUsageRules.shouldAlert(95, 0, VOLUME_ALERT_COOLDOWN_MS - 1)).toBe(false);
    expect(VolumeUsageRules.shouldAlert(95, 0, VOLUME_ALERT_COOLDOWN_MS)).toBe(true);
  });

  it('also matches the volume a legacy migration renamed', () => {
    expect(VolumeUsageRules.candidateNames('data')).toEqual(['data']);
    expect(VolumeUsageRules.candidateNames('data-sized')).toEqual(['data-sized', 'data']);
  });

  it('drops malformed entries from an agent', () => {
    expect(VolumeUsageRules.sane({ name: 'v', usedMb: 1, totalMb: 10 })).toBe(true);
    expect(VolumeUsageRules.sane({ name: '', usedMb: 1, totalMb: 10 })).toBe(false);
    expect(VolumeUsageRules.sane({ name: 'v', usedMb: -1, totalMb: 10 })).toBe(false);
    expect(VolumeUsageRules.sane({ name: 'v', usedMb: 1, totalMb: 0 })).toBe(false);
    expect(VolumeUsageRules.sane({ name: 'v', usedMb: NaN, totalMb: 10 })).toBe(false);
    expect(VolumeUsageRules.sane({ name: 9, usedMb: 1, totalMb: 10 })).toBe(false);
  });
});
