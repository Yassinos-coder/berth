import { describe, expect, it, vi } from 'vitest';
import { NotFoundException } from '@nestjs/common';
import { EdgeTrafficService } from './edge-traffic.service';

const NOW = Date.UTC(2026, 10, 17, 12, 30, 15);

function build(options: { owners?: Map<string, unknown>; recent?: unknown[]; range?: unknown[] | null } = {}) {
  const repository = {
    ownersByDomain: vi.fn().mockResolvedValue(
      options.owners ?? new Map([['a.example.com', { serviceId: 's1', serviceName: 'api', orgId: 'o1' }]]),
    ),
    add: vi.fn().mockResolvedValue(undefined),
    recent: vi.fn().mockResolvedValue(options.recent ?? []),
    inRange: vi.fn().mockResolvedValue(options.range === undefined ? [] : options.range),
    prune: vi.fn().mockResolvedValue(undefined),
  };
  const notifications = { notify: vi.fn().mockResolvedValue(undefined) };
  return { sut: new EdgeTrafficService(repository as never, notifications as never), repository, notifications };
}

const entry = (overrides = {}) => ({ domain: 'a.example.com', requests: 100, status4xx: 0, status5xx: 0, p95Ms: 40, ...overrides });

describe('EdgeTrafficService.record', () => {
  it('stores one sample per service for the current minute', async () => {
    const { sut, repository } = build();
    await sut.record('srv', [entry()], NOW);
    const rows = repository.add.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ serviceId: 's1', requests: 100, p95Ms: 40 });
    expect(rows[0].ts.getTime()).toBe(Date.UTC(2026, 10, 17, 12, 30));
  });

  it('ignores domains Berth does not route to a service', async () => {
    const { sut, repository } = build({ owners: new Map() });
    await sut.record('srv', [entry({ domain: 'scanner.example.com' })], NOW);
    expect(repository.add).toHaveBeenCalledWith([]);
  });

  it('drops malformed entries before touching the database', async () => {
    const { sut, repository } = build();
    await sut.record('srv', [entry({ requests: 0 }), entry({ p95Ms: -5 })], NOW);
    expect(repository.ownersByDomain).not.toHaveBeenCalled();
  });

  it('merges several domains of one service into one sample', async () => {
    const owners = new Map([
      ['a.example.com', { serviceId: 's1', serviceName: 'api', orgId: 'o1' }],
      ['b.example.com', { serviceId: 's1', serviceName: 'api', orgId: 'o1' }],
    ]);
    const { sut, repository } = build({ owners });
    await sut.record('srv', [entry(), entry({ domain: 'b.example.com', requests: 300, p95Ms: 80 })], NOW);
    const rows = repository.add.mock.calls[0][0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ requests: 400, p95Ms: 70 });
  });

  it('alerts once when the recent window is failing, then stays quiet', async () => {
    const { sut, notifications } = build({ recent: [{ requests: 100, errors5xx: 40 }] });
    await sut.record('srv', [entry({ status5xx: 40 })], NOW);
    await sut.record('srv', [entry({ status5xx: 40 })], NOW + 60_000);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0][1].title).toBe('api is returning errors');
  });

  it('does not alert when the service is healthy', async () => {
    const { sut, notifications } = build({ recent: [{ requests: 1000, errors5xx: 2 }] });
    await sut.record('srv', [entry()], NOW);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});

describe('EdgeTrafficService.traffic', () => {
  it('404s for a service outside the organisation', async () => {
    const { sut } = build({ range: null });
    await expect(sut.traffic('o1', 'nope', '1h')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('summarises what was recorded', async () => {
    const { sut } = build({ range: [{ ts: new Date(NOW), requests: 10, errors4xx: 0, errors5xx: 1, p95Ms: 25 }] });
    const dto = await sut.traffic('o1', 's1', '1h');
    expect(dto).toMatchObject({ hasTraffic: true, requests: 10, errors5xx: 1, p95Ms: 25 });
  });
});
