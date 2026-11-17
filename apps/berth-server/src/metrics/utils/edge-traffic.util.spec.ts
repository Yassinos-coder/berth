import { describe, expect, it } from 'vitest';
import { EdgeAlertRulesUtil, EDGE_ALERT_COOLDOWN_MS } from './edge-alert-rules.util';
import { EdgeTrafficBucketerUtil } from './edge-traffic-bucketer.util';
import { EdgeEntryValidator } from '../validators/edge-entry.validator';

const sample = (minute: number, requests: number, errors5xx = 0, p95Ms = 50, errors4xx = 0) => ({
  ts: new Date(Date.UTC(2026, 10, 17, 12, minute)),
  requests,
  errors4xx,
  errors5xx,
  p95Ms,
});

describe('EdgeAlertRulesUtil', () => {
  it('needs both enough traffic and a high enough error rate', () => {
    expect(EdgeAlertRulesUtil.shouldAlert([sample(0, 10, 10)], undefined, 0)).toBe(false);
    expect(EdgeAlertRulesUtil.shouldAlert([sample(0, 100, 4)], undefined, 0)).toBe(false);
    expect(EdgeAlertRulesUtil.shouldAlert([sample(0, 100, 5)], undefined, 0)).toBe(true);
  });

  it('sums the window before judging, so one bad minute among good ones is ignored', () => {
    const recent = [sample(0, 500, 0), sample(1, 500, 0), sample(2, 20, 20)];
    expect(EdgeAlertRulesUtil.shouldAlert(recent, undefined, 0)).toBe(false);
  });

  it('waits out the cooldown before alerting again', () => {
    const bad = [sample(0, 100, 50)];
    expect(EdgeAlertRulesUtil.shouldAlert(bad, 0, EDGE_ALERT_COOLDOWN_MS - 1)).toBe(false);
    expect(EdgeAlertRulesUtil.shouldAlert(bad, 0, EDGE_ALERT_COOLDOWN_MS)).toBe(true);
  });

  it('gives a shared domain to its catch-all service', () => {
    const owner = EdgeAlertRulesUtil.primaryOwner([{ path: '/api', id: 'api' }, { path: '/', id: 'web' }]);
    expect(owner?.id).toBe('web');
    expect(EdgeAlertRulesUtil.primaryOwner([{ path: '/api', id: 'api' }])?.id).toBe('api');
  });

  it('averages latency by request volume', () => {
    expect(EdgeAlertRulesUtil.weightedP95([sample(0, 900, 0, 100), sample(1, 100, 0, 1000)])).toBe(190);
    expect(EdgeAlertRulesUtil.weightedP95([])).toBe(0);
  });
});

describe('EdgeTrafficBucketerUtil', () => {
  it('totals the range and groups it into buckets', () => {
    const dto = EdgeTrafficBucketerUtil.summarise(
      [sample(0, 100, 1, 40, 2), sample(1, 100, 3, 60, 0), sample(10, 50, 0, 20, 5)],
      10 * 60_000,
    );
    expect(dto.requests).toBe(250);
    expect(dto.errors5xx).toBe(4);
    expect(dto.errors4xx).toBe(7);
    expect(dto.errorRatePct).toBe(1.6);
    expect(dto.series.map((point) => point.requests)).toEqual([200, 50]);
    expect(dto.hasTraffic).toBe(true);
  });

  it('reports an empty range plainly', () => {
    const dto = EdgeTrafficBucketerUtil.summarise([], 60_000);
    expect(dto).toMatchObject({ hasTraffic: false, requests: 0, errorRatePct: 0, p95Ms: 0, series: [] });
  });
});

describe('EdgeEntryValidator', () => {
  const entry = { domain: 'a.example.com', requests: 10, status4xx: 1, status5xx: 2, p95Ms: 30 };

  it('accepts a normal summary', () => {
    expect(EdgeEntryValidator.sane(entry)).toBe(true);
  });

  it('rejects impossible or hostile values', () => {
    expect(EdgeEntryValidator.sane({ ...entry, requests: 0 })).toBe(false);
    expect(EdgeEntryValidator.sane({ ...entry, status5xx: 20 })).toBe(false);
    expect(EdgeEntryValidator.sane({ ...entry, p95Ms: -1 })).toBe(false);
    expect(EdgeEntryValidator.sane({ ...entry, requests: 1.5 })).toBe(false);
    expect(EdgeEntryValidator.sane({ ...entry, domain: '' })).toBe(false);
    expect(EdgeEntryValidator.sane({ ...entry, domain: 'x'.repeat(300) })).toBe(false);
    expect(EdgeEntryValidator.sane({ ...entry, requests: 1e9 })).toBe(false);
  });
});
