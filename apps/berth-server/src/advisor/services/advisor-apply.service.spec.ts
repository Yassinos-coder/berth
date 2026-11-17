import { describe, expect, it, vi } from 'vitest';
import { BadRequestException } from '@nestjs/common';
import { AdvisorApplyService } from './advisor-apply.service';
import { UndoMapper } from '../mappers/undo.mapper';

const USER = { id: 'u1', orgId: 'o1', role: 'admin' } as never;

function finding(overrides: Record<string, unknown> = {}) {
  return {
    id: 'f1',
    orgId: 'o1',
    kind: 'resources',
    severity: 'info',
    source: 'rules',
    status: 'open',
    title: 't',
    detail: 'd',
    evidence: [],
    action: { type: 'set-resources', serviceId: 's1', memoryMb: 1024 },
    undo: null,
    serviceId: 's1',
    createdAt: new Date(),
    resolvedAt: null,
    ...overrides,
  };
}

function build(found: unknown) {
  const service = { id: 's1', name: 'api', cpuCores: 1, memoryMb: 512, diskGb: null, autoRollback: false };
  const repository = {
    findFinding: vi.fn().mockResolvedValue(found),
    serviceIds: vi.fn().mockResolvedValue(new Set(['s1'])),
    currentService: vi.fn().mockResolvedValue(service),
    markResolved: vi.fn().mockImplementation(async (_id, status, _by, undo) => ({ ...(found as object), status, undo })),
    clearUndo: vi.fn().mockImplementation(async () => ({ ...(found as object), status: 'dismissed', undo: null })),
    servicesBrief: vi.fn().mockResolvedValue([service]),
  };
  const services = { updateSettings: vi.fn().mockResolvedValue({}) };
  const activity = { record: vi.fn().mockResolvedValue(undefined) };
  const sut = new AdvisorApplyService(repository as never, services as never, activity as never);
  return { sut, repository, services, activity };
}

describe('AdvisorApplyService', () => {
  it('applies the action and stores what it replaced', async () => {
    const { sut, services, repository } = build(finding());
    const result = await sut.apply(USER, 'f1');
    expect(services.updateSettings).toHaveBeenCalledWith(USER, 's1', { resources: { memoryMb: 1024 } });
    expect(repository.markResolved).toHaveBeenCalledWith('f1', 'applied', 'u1', { serviceId: 's1', memoryMb: 512 });
    expect(result.status).toBe('applied');
  });

  it('refuses an action that is out of bounds without touching the service', async () => {
    const { sut, services } = build(finding({ action: { type: 'set-resources', serviceId: 's1', memoryMb: 999999999 } }));
    await expect(sut.apply(USER, 'f1')).rejects.toBeInstanceOf(BadRequestException);
    expect(services.updateSettings).not.toHaveBeenCalled();
  });

  it('refuses an action that points at an unknown service', async () => {
    const { sut, services } = build(finding({ action: { type: 'enable-auto-rollback', serviceId: 'other' } }));
    await expect(sut.apply(USER, 'f1')).rejects.toBeInstanceOf(BadRequestException);
    expect(services.updateSettings).not.toHaveBeenCalled();
  });

  it('refuses to apply a suggestion twice', async () => {
    const { sut } = build(finding({ status: 'applied' }));
    await expect(sut.apply(USER, 'f1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('undoes an applied change by restoring the stored values', async () => {
    const { sut, services } = build(finding({ status: 'applied', undo: { serviceId: 's1', memoryMb: 512 } }));
    await sut.undo(USER, 'f1');
    expect(services.updateSettings).toHaveBeenCalledWith(USER, 's1', { resources: { memoryMb: 512 } });
  });

  it('cannot undo when nothing was stored', async () => {
    const { sut } = build(finding({ status: 'applied', undo: null }));
    await expect(sut.undo(USER, 'f1')).rejects.toBeInstanceOf(BadRequestException);
  });

  it('dismisses without changing any service', async () => {
    const { sut, services } = build(finding());
    await sut.dismiss(USER, 'f1');
    expect(services.updateSettings).not.toHaveBeenCalled();
  });
});

describe('UndoMapper', () => {
  it('ignores malformed stored undo data', () => {
    expect(UndoMapper.parse('x')).toBeNull();
    expect(UndoMapper.parse({ memoryMb: 1 })).toBeNull();
  });
});
