import { describe, expect, it } from 'vitest';
import { ServiceMoveValidator } from './service-move.validator';

const service = { serverId: 's1', volumePath: null, previewOfId: null };
const target = { id: 's2', status: 'online' };

describe('ServiceMoveValidator', () => {
  it('allows a stateless service to move to an online server', () => {
    expect(ServiceMoveValidator.conflict(service, target, false)).toBeNull();
  });

  it('refuses a missing, identical or offline target', () => {
    expect(ServiceMoveValidator.conflict(service, null, false)).toMatch(/not found/);
    expect(ServiceMoveValidator.conflict(service, { id: 's1', status: 'online' }, false)).toMatch(/already runs/);
    expect(ServiceMoveValidator.conflict(service, { id: 's2', status: 'offline' }, false)).toMatch(/offline/);
    expect(ServiceMoveValidator.conflict(service, { id: 's2', status: 'enrolling' }, false)).toMatch(/offline/);
  });

  it('will not move a service that has files unless the data loss is confirmed', () => {
    const stateful = { ...service, volumePath: '/data' };
    expect(ServiceMoveValidator.conflict(stateful, target, false)).toMatch(/do not move/);
    expect(ServiceMoveValidator.conflict(stateful, target, true)).toBeNull();
  });

  it('never moves a preview environment on its own', () => {
    expect(ServiceMoveValidator.conflict({ ...service, previewOfId: 'p' }, target, true)).toMatch(/Preview/);
  });
});
