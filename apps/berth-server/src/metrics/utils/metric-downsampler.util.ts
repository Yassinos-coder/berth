import type { MetricReading } from '../interfaces';

export class MetricDownsamplerUtil {
  static bucket(samples: MetricReading[], bucketMs: number): MetricReading[] {
    const buckets = new Map<number, { count: number; cpuSum: number; memMax: number; rx: number; tx: number }>();

    for (const sample of samples) {
      const key = Math.floor(sample.ts / bucketMs) * bucketMs;
      const entry = buckets.get(key) ?? { count: 0, cpuSum: 0, memMax: 0, rx: 0, tx: 0 };
      entry.count += 1;
      entry.cpuSum += sample.cpuPct;
      entry.memMax = Math.max(entry.memMax, sample.memMb);
      entry.rx = sample.netRxMb;
      entry.tx = sample.netTxMb;
      buckets.set(key, entry);
    }

    return [...buckets.entries()]
      .sort(([a], [b]) => a - b)
      .map(([ts, entry]) => ({
        ts,
        cpuPct: entry.cpuSum / entry.count,
        memMb: entry.memMax,
        netRxMb: entry.rx,
        netTxMb: entry.tx,
      }));
  }
}
