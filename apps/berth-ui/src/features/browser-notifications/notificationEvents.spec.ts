import { describe, expect, it } from 'vitest';
import { NotificationEvents } from '@/features/browser-notifications/notificationEvents';
import type { Deployment, Service } from '@/interfaces';

const deployment = (status: Deployment['status'], id = 'd1'): Deployment =>
  ({ id, serviceId: 's1', serviceName: 'api', status, trigger: 'push', createdAt: '', commitMessage: 'Fix login' }) as Deployment;
const service = (state: string): Service => ({ id: 's1', name: 'api', state }) as unknown as Service;

describe('NotificationEvents', () => {
  it('announces a build that finishes', () => {
    const before = NotificationEvents.snapshot([deployment('building')], [service('running')]);
    const notices = NotificationEvents.diff(before, [deployment('live')], [service('running')]);
    expect(notices).toHaveLength(1);
    expect(notices[0].title).toBe('api is live');
    expect(notices[0].url).toBe('/services/s1');
  });

  it('announces a failed build', () => {
    const before = NotificationEvents.snapshot([deployment('deploying')], []);
    expect(NotificationEvents.diff(before, [deployment('failed')], [])[0].title).toMatch(/failed/);
  });

  it('stays quiet for history it never saw in progress', () => {
    const before = NotificationEvents.snapshot([], []);
    expect(NotificationEvents.diff(before, [deployment('live')], [])).toEqual([]);
  });

  it('does not repeat a finished deployment', () => {
    const before = NotificationEvents.snapshot([deployment('live')], []);
    expect(NotificationEvents.diff(before, [deployment('live')], [])).toEqual([]);
  });

  it('announces a crash once', () => {
    const before = NotificationEvents.snapshot([], [service('running')]);
    expect(NotificationEvents.diff(before, [], [service('crashed')])).toHaveLength(1);
    const after = NotificationEvents.snapshot([], [service('crashed')]);
    expect(NotificationEvents.diff(after, [], [service('crashed')])).toEqual([]);
  });
});
