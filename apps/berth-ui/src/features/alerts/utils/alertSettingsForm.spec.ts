import { describe, expect, it } from 'vitest';
import { AlertSettingsForm } from '@/features/alerts/utils/alertSettingsForm';

const saved = { enabled: true, cpuPct: 90, memPct: 90, diskPct: 90, minutes: 5 };

describe('AlertSettingsForm', () => {
  it('round-trips saved settings through the draft', () => {
    expect(AlertSettingsForm.toPayload(AlertSettingsForm.toDraft(saved))).toEqual(saved);
  });

  it('accepts values on the boundaries', () => {
    const draft = { ...AlertSettingsForm.toDraft(saved), cpuPct: '50', memPct: '100', diskPct: '99', minutes: '60' };
    expect(AlertSettingsForm.validate(draft)).toEqual({});
  });

  it.each([
    ['cpuPct', '49'],
    ['cpuPct', '101'],
    ['memPct', '49'],
    ['diskPct', '100'],
    ['minutes', '0'],
    ['minutes', '61'],
    ['minutes', '2.5'],
    ['minutes', ''],
    ['cpuPct', 'abc'],
  ])('rejects %s = %j', (field, value) => {
    const draft = { ...AlertSettingsForm.toDraft(saved), [field]: value };
    expect(Object.keys(AlertSettingsForm.validate(draft))).toEqual([field]);
  });

  it('reports every invalid field at once', () => {
    const draft = { ...AlertSettingsForm.toDraft(saved), cpuPct: '1', minutes: '99' };
    expect(Object.keys(AlertSettingsForm.validate(draft)).sort()).toEqual(['cpuPct', 'minutes']);
  });

  it('detects unsaved changes', () => {
    const draft = AlertSettingsForm.toDraft(saved);
    expect(AlertSettingsForm.isDirty(draft, saved)).toBe(false);
    expect(AlertSettingsForm.isDirty({ ...draft, minutes: '6' }, saved)).toBe(true);
    expect(AlertSettingsForm.isDirty({ ...draft, enabled: false }, saved)).toBe(true);
  });
});
