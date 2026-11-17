import { describe, expect, it } from 'vitest';
import { HostDiskUtil } from './host-disk.util';

const GB = 1024 ** 3;

describe('HostDiskUtil', () => {
  it('converts filesystem stats to whole gigabytes', () => {
    expect(HostDiskUtil.fromStats({ bsize: 4096, blocks: (100 * GB) / 4096, bavail: (63.7 * GB) / 4096 })).toEqual({
      totalGb: 100,
      freeGb: 63,
    });
  });

  it('suggests dedicating about half of the free space, never less than 5 GB', () => {
    expect(HostDiskUtil.suggestBudgetGb({ totalGb: 100, freeGb: 80 })).toBe(40);
    expect(HostDiskUtil.suggestBudgetGb({ totalGb: 20, freeGb: 6 })).toBe(5);
  });

  it('reads the real disk without throwing', () => {
    const disk = HostDiskUtil.read('/');
    if (disk) expect(disk.totalGb).toBeGreaterThanOrEqual(disk.freeGb);
  });

  it('returns null for a path that does not exist', () => {
    expect(HostDiskUtil.read('/definitely/not/here')).toBeNull();
  });
});
