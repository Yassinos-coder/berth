import { describe, expect, it } from 'vitest';
import { StorageBudgetRules as Rules } from './storageBudgetRules';

describe('StorageBudgetRules', () => {
  it('never allows less than 5 GB', () => {
    expect(Rules.minimumBudgetGb(0)).toBe(5);
    expect(Rules.minimumBudgetGb(2)).toBe(5);
  });

  it('needs room for what services already use plus the reserve', () => {
    expect(Rules.minimumBudgetGb(21)).toBe(25);
    expect(Rules.minimumBudgetGb(16)).toBe(19);
  });

  it('caps the budget at the real disk when it is known', () => {
    expect(Rules.maximumBudgetGb(100)).toBe(100);
    expect(Rules.maximumBudgetGb(null)).toBe(65536);
  });
});
