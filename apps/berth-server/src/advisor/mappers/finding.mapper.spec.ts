import { describe, expect, it } from 'vitest';
import { FindingMapper } from './finding.mapper';

const service = { id: 's1', name: 'api', cpuCores: 1, memoryMb: 512, diskGb: null };

const finding = (overrides: Record<string, unknown> = {}) =>
  ({
    id: 'f1',
    kind: 'resources',
    severity: 'warning',
    source: 'rules',
    status: 'open',
    title: 't',
    detail: 'd',
    evidence: ['peak 1 GB', 7],
    action: { type: 'set-resources', serviceId: 's1', memoryMb: 1024 },
    undo: null,
    serviceId: 's1',
    createdAt: new Date('2026-11-17T10:00:00Z'),
    resolvedAt: null,
    ...overrides,
  }) as never;

describe('FindingMapper.toDto', () => {
  const services = new Map([['s1', service]]);

  it('describes an open suggestion with what would change', () => {
    const dto = FindingMapper.toDto(finding(), services);
    expect(dto.actionLabel).toBe('Change api: memory 512 MB → 1024 MB');
    expect(dto.action).toBeDefined();
    expect(dto.evidence).toEqual(['peak 1 GB']);
    expect(dto.canUndo).toBe(false);
  });

  it('drops the action and label once handled, and offers undo only when it can', () => {
    const applied = FindingMapper.toDto(finding({ status: 'applied', undo: { serviceId: 's1', memoryMb: 512 } }), services);
    expect(applied.action).toBeUndefined();
    expect(applied.actionLabel).toBeUndefined();
    expect(applied.canUndo).toBe(true);
    expect(FindingMapper.toDto(finding({ status: 'dismissed' }), services).canUndo).toBe(false);
  });
});

describe('FindingMapper.settingsDto', () => {
  it('reports whether a key exists without ever returning it', () => {
    const dto = FindingMapper.settingsDto({
      enabled: true, provider: 'anthropic', baseUrl: '', model: 'm', apiKeyEncrypted: 'ciphertext',
      monthlyCapUsd: 5, spentUsd: 0.123456789, priceInPerMTok: 1, priceOutPerMTok: 2,
      periodStart: new Date('2026-11-01T00:00:00Z'), lastRunAt: null, lastError: null,
    } as never);
    expect(dto.hasKey).toBe(true);
    expect(JSON.stringify(dto)).not.toContain('ciphertext');
    expect(dto.spentUsd).toBe(0.1235);
  });
});
