import { describe, expect, it } from 'vitest';
import { AdvisorBudget as B } from './advisor-budget.util';

describe('AdvisorBudget', () => {
  it('prices tokens per million', () => {
    expect(B.costUsd(1_000_000, 0, 3, 15)).toBe(3);
    expect(B.costUsd(0, 1_000_000, 3, 15)).toBe(15);
    expect(B.costUsd(2000, 1000, 3, 15)).toBeCloseTo(0.021, 6);
  });

  it('estimates tokens from text length, rounding up', () => {
    expect(B.estimateTokens('')).toBe(0);
    expect(B.estimateTokens('a'.repeat(7))).toBe(2);
  });

  it('reserves the worst case before a call', () => {
    expect(B.worstCaseUsd(10_000, 3000, 3, 15)).toBeCloseTo(0.075, 6);
  });

  it('never allows spending past the cap, counting the reservation', () => {
    expect(B.canSpend(4.9, 5, 0.05)).toBe(true);
    expect(B.canSpend(4.96, 5, 0.05)).toBe(false);
    expect(B.canSpend(0, 0, 0)).toBe(false);
    expect(B.canSpend(5, 5, 0)).toBe(true);
  });

  it('resets monthly', () => {
    expect(B.periodExpired(new Date('2026-11-01T00:00:00Z'), new Date('2026-11-30T23:59:59Z'))).toBe(false);
    expect(B.periodExpired(new Date('2026-11-30T23:59:59Z'), new Date('2026-12-01T00:00:01Z'))).toBe(true);
    expect(B.periodExpired(new Date('2025-11-17T00:00:00Z'), new Date('2026-11-17T00:00:00Z'))).toBe(true);
  });

  it('reports what is left', () => {
    expect(B.remainingUsd(1.5, 5)).toBe(3.5);
    expect(B.remainingUsd(9, 5)).toBe(0);
  });
});
