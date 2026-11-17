import { statfsSync } from 'node:fs';

export interface HostDisk {
  totalGb: number;
  freeGb: number;
}

const GB = 1024 ** 3;

export class HostDiskUtil {
  static fromStats(stats: { bsize: number; blocks: number; bavail: number }): HostDisk {
    return {
      totalGb: Math.floor((stats.blocks * stats.bsize) / GB),
      freeGb: Math.floor((stats.bavail * stats.bsize) / GB),
    };
  }

  static read(path = '/'): HostDisk | null {
    try {
      const stats = statfsSync(path);
      return HostDiskUtil.fromStats({
        bsize: Number(stats.bsize),
        blocks: Number(stats.blocks),
        bavail: Number(stats.bavail),
      });
    } catch {
      return null;
    }
  }

  static suggestBudgetGb(disk: HostDisk): number {
    const half = Math.floor(disk.freeGb / 2);
    return Math.max(5, Math.min(half, disk.freeGb));
  }
}
