import { describe, expect, it, vi } from 'vitest';
import { MetricsRecorderService } from './metrics-recorder.service';

const ORG = { alertsEnabled: true, alertCpuPct: 90, alertMemPct: 90, alertDiskPct: 90, alertMinutes: 5 };

const svc = (overrides: object = {}, org: object = {}) => ({
  id: 's1',
  name: 'web',
  orgId: 'o1',
  cpuCores: 1,
  memoryMb: 1000,
  alertsMuted: false,
  org: { ...ORG, ...org },
  ...overrides,
});

function build(limits = [svc()], serverOrg: object = {}) {
  const repository = {
    createMany: vi.fn().mockResolvedValue(undefined),
    serviceLimits: vi.fn().mockResolvedValue(limits),
    prune: vi.fn().mockResolvedValue(0),
    serverInfo: vi.fn().mockResolvedValue({ name: 'vps', orgId: 'o1', org: { ...ORG, ...serverOrg } }),
  };
  const notifications = { notify: vi.fn().mockResolvedValue(undefined) };
  const recorder = new MetricsRecorderService(repository as never, notifications as never);
  return { recorder, repository, notifications };
}

const sample = (cpuPct: number, memMb: number) => ({ cpuPct, memMb, netRxMb: 1, netTxMb: 2 });

describe('MetricsRecorderService', () => {
  it('writes one averaged row per service per flush', async () => {
    const { recorder, repository } = build();
    recorder.record('s1', sample(10, 100));
    recorder.record('s1', sample(30, 400));
    await recorder.flush(120_000);
    const [rows] = repository.createMany.mock.calls[0];
    expect(rows).toEqual([
      { serviceId: 's1', ts: new Date(120_000), cpuPct: 20, memMb: 400, netRxMb: 1, netTxMb: 2 },
    ]);
  });

  it('writes nothing when no samples arrived', async () => {
    const { recorder, repository } = build();
    await recorder.flush();
    expect(repository.createMany).toHaveBeenCalledWith([]);
    expect(repository.serviceLimits).not.toHaveBeenCalled();
  });

  it('alerts after five sustained high minutes, once', async () => {
    const { recorder, notifications } = build();
    for (let minute = 0; minute < 8; minute += 1) {
      recorder.record('s1', sample(10, 950));
      await recorder.flush(minute * 60_000);
    }
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const [orgId, event] = notifications.notify.mock.calls[0];
    expect(orgId).toBe('o1');
    expect(event).toMatchObject({ type: 'resource.high', severity: 'warning' });
    expect(event.title).toContain('memory');
  });

  it('does not alert for a muted service', async () => {
    const { recorder, notifications } = build([svc({ alertsMuted: true })]);
    for (let minute = 0; minute < 8; minute += 1) {
      recorder.record('s1', sample(10, 950));
      await recorder.flush(minute * 60_000);
    }
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('does not alert when the organization turned alerts off', async () => {
    const { recorder, notifications } = build([svc({}, { alertsEnabled: false })]);
    for (let minute = 0; minute < 8; minute += 1) {
      recorder.record('s1', sample(10, 950));
      await recorder.flush(minute * 60_000);
    }
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('uses the organization thresholds and names them in the message', async () => {
    const { recorder, notifications } = build([svc({}, { alertMemPct: 60, alertMinutes: 2 })]);
    for (let minute = 0; minute < 3; minute += 1) {
      recorder.record('s1', sample(10, 700));
      await recorder.flush(minute * 60_000);
    }
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0][1].detail).toContain('over 60%');
    expect(notifications.notify.mock.calls[0][1].detail).toContain('2+ minutes');
  });

  it('forgets a service that stops reporting', async () => {
    const { recorder, notifications } = build();
    for (let minute = 0; minute < 4; minute += 1) {
      recorder.record('s1', sample(10, 950));
      await recorder.flush(minute * 60_000);
    }
    await recorder.flush(5 * 60_000);
    for (let minute = 6; minute < 9; minute += 1) {
      recorder.record('s1', sample(10, 950));
      await recorder.flush(minute * 60_000);
    }
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('survives a database failure', async () => {
    const { recorder, repository } = build();
    repository.createMany.mockRejectedValue(new Error('db down'));
    recorder.record('s1', sample(1, 1));
    await expect(recorder.flush()).resolves.toBeUndefined();
  });

  it('alerts on a nearly full disk, then stays quiet during the cooldown', async () => {
    const { recorder, notifications } = build();
    await recorder.observeHostDisk('srv', 95, 100);
    await recorder.observeHostDisk('srv', 96, 100);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0][1].title).toContain('vps');
  });

  it('uses the configured disk threshold', async () => {
    const { recorder, notifications } = build([svc()], { alertDiskPct: 70 });
    await recorder.observeHostDisk('srv', 75, 100);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
  });

  it('stays quiet about disks when alerts are off', async () => {
    const { recorder, notifications } = build([svc()], { alertsEnabled: false });
    await recorder.observeHostDisk('srv', 99, 100);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('ignores healthy disks', async () => {
    const { recorder, notifications } = build();
    await recorder.observeHostDisk('srv', 10, 100);
    expect(notifications.notify).not.toHaveBeenCalled();
  });
});
