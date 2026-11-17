import { describe, expect, it, vi } from 'vitest';
import { OFFLINE_GRACE_MS, ServerHealthRules } from './server-health.rules';
import { ServerHealthService } from './server-health.service';

const NOW = Date.UTC(2026, 10, 17, 12, 0, 0);
const server = (overrides = {}) => ({
  id: 's1', orgId: 'o1', name: 'alpha', status: 'offline',
  lastSeenAt: new Date(NOW - 10 * 60_000), offlineAlertedAt: null, ...overrides,
});

function build(found: unknown[], claimed = 1) {
  const prisma = {
    server: {
      findMany: vi.fn().mockResolvedValue(found),
      findUnique: vi.fn().mockResolvedValue(found[0] ?? null),
      updateMany: vi.fn().mockResolvedValue({ count: claimed }),
    },
  };
  const notifications = { notify: vi.fn().mockResolvedValue(undefined) };
  return { sut: new ServerHealthService(prisma as never, notifications as never), prisma, notifications };
}

describe('ServerHealthRules', () => {
  it('waits out a short reconnect before calling a server offline', () => {
    expect(ServerHealthRules.dueForOfflineAlert(server({ lastSeenAt: new Date(NOW - OFFLINE_GRACE_MS + 1000) }), NOW)).toBe(false);
    expect(ServerHealthRules.dueForOfflineAlert(server({ lastSeenAt: new Date(NOW - OFFLINE_GRACE_MS) }), NOW)).toBe(true);
  });

  it('alerts once, and never for a server that is online or still enrolling', () => {
    expect(ServerHealthRules.dueForOfflineAlert(server({ offlineAlertedAt: new Date(NOW) }), NOW)).toBe(false);
    expect(ServerHealthRules.dueForOfflineAlert(server({ status: 'online' }), NOW)).toBe(false);
    expect(ServerHealthRules.dueForOfflineAlert(server({ status: 'enrolling' }), NOW)).toBe(false);
  });

  it('describes the outage in plain units', () => {
    expect(ServerHealthRules.offlineFor({ lastSeenAt: new Date(NOW - 30_000) }, NOW)).toBe('1 minute');
    expect(ServerHealthRules.offlineFor({ lastSeenAt: new Date(NOW - 25 * 60_000) }, NOW)).toBe('25 minutes');
    expect(ServerHealthRules.offlineFor({ lastSeenAt: new Date(NOW - 3 * 3600_000) }, NOW)).toBe('3 hours');
  });
});

describe('ServerHealthService', () => {
  it('sends one offline alert for a server gone past the grace period', async () => {
    const { sut, notifications } = build([server()]);
    await sut.sweep(NOW);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0][1]).toMatchObject({ type: 'server.offline', severity: 'error' });
  });

  it('does not alert when another panel process already claimed it', async () => {
    const { sut, notifications } = build([server()], 0);
    await sut.sweep(NOW);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('stays quiet inside the grace period', async () => {
    const { sut, notifications } = build([server({ lastSeenAt: new Date(NOW - 30_000) })]);
    await sut.sweep(NOW);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('announces recovery only if an offline alert had been sent', async () => {
    const alerted = build([server({ offlineAlertedAt: new Date(NOW - 15 * 60_000) })]);
    await alerted.sut.onConnected('s1', NOW);
    expect(alerted.notifications.notify.mock.calls[0][1]).toMatchObject({ type: 'server.online' });

    const quiet = build([server({ offlineAlertedAt: null })]);
    await quiet.sut.onConnected('s1', NOW);
    expect(quiet.notifications.notify).not.toHaveBeenCalled();
  });
});
