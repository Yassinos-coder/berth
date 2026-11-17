import { describe, expect, it } from 'vitest';
import { VolumeUsageRules } from '@/features/services/volumeUsageRules';

describe('VolumeUsageRules', () => {
  it('rounds and bounds the percentage', () => {
    expect(VolumeUsageRules.percent(512, 2048)).toBe(25);
    expect(VolumeUsageRules.percent(3000, 2048)).toBe(100);
    expect(VolumeUsageRules.percent(1, 0)).toBe(0);
  });

  it('warns from 80 percent and goes critical from 90', () => {
    expect(VolumeUsageRules.level(79)).toBe('ok');
    expect(VolumeUsageRules.level(80)).toBe('warning');
    expect(VolumeUsageRules.level(90)).toBe('critical');
  });

  it('formats sizes readably', () => {
    expect(VolumeUsageRules.format(300)).toBe('300 MB');
    expect(VolumeUsageRules.format(1536)).toBe('1.5 GB');
    expect(VolumeUsageRules.format(20480)).toBe('20 GB');
  });

  it('treats readings older than ten minutes as stale', () => {
    const now = Date.parse('2026-11-17T12:00:00Z');
    expect(VolumeUsageRules.stale('2026-11-17T11:55:00Z', now)).toBe(false);
    expect(VolumeUsageRules.stale('2026-11-17T11:40:00Z', now)).toBe(true);
  });
});
