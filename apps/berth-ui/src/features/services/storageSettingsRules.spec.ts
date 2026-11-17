import { describe, expect, it } from 'vitest';
import { StorageSettingsRules as Rules } from './storageSettingsRules';

describe('StorageSettingsRules', () => {
  it('validates the size', () => {
    expect(Rules.sizeError(10)).toBeNull();
    expect(Rules.sizeError(0)).toContain('At least');
    expect(Rules.sizeError(5000)).toContain('At most');
    expect(Rules.sizeError(2.5)).toContain('whole number');
  });

  it('only counts the extra space a growing volume needs', () => {
    expect(Rules.growthProblem(10, 5, 5)).toBeNull();
    expect(Rules.growthProblem(11, 5, 5)).toContain('needs 6 GB more');
    expect(Rules.growthProblem(3, 5, 0)).toBeNull();
  });

  it('does not limit growth on a server with no budget', () => {
    expect(Rules.growthProblem(500, 5, null)).toBeNull();
  });

  it('classifies a change', () => {
    expect(Rules.change(5, 5)).toBe('same');
    expect(Rules.change(10, 5)).toBe('grow');
    expect(Rules.change(2, 5)).toBe('shrink');
  });
});
