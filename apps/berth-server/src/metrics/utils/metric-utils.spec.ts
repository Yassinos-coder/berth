import { describe, expect, it } from 'vitest';
import { DEFAULT_ALERT_THRESHOLDS, MetricAlertRulesUtil } from './metric-alert-rules.util';
import { MetricDownsamplerUtil } from './metric-downsampler.util';
import { MetricRangeValidator } from '../validators/metric-range.validator';

const reading = (ts: number, cpuPct: number, memMb: number) => ({ ts, cpuPct, memMb, netRxMb: ts, netTxMb: 0 });

describe('MetricDownsamplerUtil', () => {
  it('averages cpu, takes peak memory, and keeps the latest network counters', () => {
    const out = MetricDownsamplerUtil.bucket(
      [reading(1_000, 10, 100), reading(2_000, 30, 300), reading(61_000, 50, 50)],
      60_000,
    );
    expect(out).toEqual([
      { ts: 0, cpuPct: 20, memMb: 300, netRxMb: 2_000, netTxMb: 0 },
      { ts: 60_000, cpuPct: 50, memMb: 50, netRxMb: 61_000, netTxMb: 0 },
    ]);
  });

  it('sorts buckets by time regardless of input order', () => {
    const out = MetricDownsamplerUtil.bucket([reading(130_000, 1, 1), reading(5_000, 1, 1)], 60_000);
    expect(out.map((point) => point.ts)).toEqual([0, 120_000]);
  });

  it('returns nothing for no samples', () => {
    expect(MetricDownsamplerUtil.bucket([], 60_000)).toEqual([]);
  });
});

describe('MetricRangeValidator', () => {
  it('resolves known ranges', () => {
    expect(MetricRangeValidator.resolve('1h').bucketMs).toBe(60_000);
    expect(MetricRangeValidator.resolve('7d').rangeMs).toBe(7 * 24 * 3_600_000);
  });

  it('falls back to 24h for unknown and prototype keys', () => {
    const fallback = MetricRangeValidator.resolve('24h');
    expect(MetricRangeValidator.resolve(undefined)).toEqual(fallback);
    expect(MetricRangeValidator.resolve('constructor')).toEqual(fallback);
    expect(MetricRangeValidator.resolve('99y')).toEqual(fallback);
  });
});

describe('MetricAlertRulesUtil', () => {
  const limits = { cpuCores: 2, memoryMb: 1000 };
  const hot = { cpuPct: 190, memMb: 950 };
  const cool = { cpuPct: 10, memMb: 100 };

  const run = (
    readings: { cpuPct: number; memMb: number }[],
    start = 0,
    thresholds = DEFAULT_ALERT_THRESHOLDS,
  ) => {
    let watch = MetricAlertRulesUtil.emptyWatch();
    const fired: string[][] = [];
    readings.forEach((item, index) => {
      const result = MetricAlertRulesUtil.evaluate(watch, item, limits, thresholds, start + index * 60_000);
      watch = result.watch;
      fired.push(result.fired);
    });
    return { watch, fired };
  };

  it('stays quiet below the sustained window', () => {
    expect(run(Array(4).fill(hot)).fired.flat()).toEqual([]);
  });

  it('fires cpu and memory once the window is reached', () => {
    expect(run(Array(5).fill(hot)).fired[4].sort()).toEqual(['cpu', 'memory']);
  });

  it('measures cpu against the core allocation', () => {
    const oneCore = MetricAlertRulesUtil.evaluate(
      MetricAlertRulesUtil.emptyWatch(),
      { cpuPct: 95, memMb: 0 },
      { cpuCores: 4, memoryMb: 1000 },
      DEFAULT_ALERT_THRESHOLDS,
      0,
    );
    expect(oneCore.watch.cpuHighMinutes).toBe(0);
  });

  it('resets the streak when usage drops', () => {
    const { fired } = run([hot, hot, hot, hot, cool, hot]);
    expect(fired.flat()).toEqual([]);
  });

  it('does not re-fire inside the cooldown, then fires again after it', () => {
    const readings = Array(12).fill(hot);
    expect(run(readings).fired.flat().filter((kind) => kind === 'cpu')).toHaveLength(1);

    const long = Array(70).fill(hot);
    expect(run(long).fired.flat().filter((kind) => kind === 'cpu')).toHaveLength(2);
  });

  it('fires sooner and at a lower level with custom thresholds', () => {
    const custom = { ...DEFAULT_ALERT_THRESHOLDS, cpuPct: 50, memPct: 50, minutes: 2 };
    const moderate = { cpuPct: 120, memMb: 600 };
    expect(run([moderate], 0, custom).fired.flat()).toEqual([]);
    expect(run([moderate, moderate], 0, custom).fired[1].sort()).toEqual(['cpu', 'memory']);
    expect(run([moderate, moderate], 0).fired.flat()).toEqual([]);
  });

  it('needs the longer window when the minutes setting is raised', () => {
    const slow = { ...DEFAULT_ALERT_THRESHOLDS, minutes: 10 };
    expect(run(Array(9).fill(hot), 0, slow).fired.flat()).toEqual([]);
    expect(run(Array(10).fill(hot), 0, slow).fired[9].sort()).toEqual(['cpu', 'memory']);
  });

  it('flags a nearly full disk only', () => {
    expect(MetricAlertRulesUtil.diskHigh(91, 100, 90)).toBe(true);
    expect(MetricAlertRulesUtil.diskHigh(50, 100, 90)).toBe(false);
    expect(MetricAlertRulesUtil.diskHigh(1, 0, 90)).toBe(false);
  });

  it('honours a custom disk threshold', () => {
    expect(MetricAlertRulesUtil.diskHigh(75, 100, 70)).toBe(true);
    expect(MetricAlertRulesUtil.diskHigh(75, 100, 80)).toBe(false);
  });
});
