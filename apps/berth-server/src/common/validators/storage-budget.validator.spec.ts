import { describe, expect, it } from 'vitest';
import { StorageBudgetValidator as V } from './storage-budget.validator';

describe('StorageBudgetValidator', () => {
  it('keeps a reserve for images, build cache and logs', () => {
    expect(V.reserveGb(25)).toBe(4);
    expect(V.allocatableGb(25)).toBe(21);
    expect(V.reserveGb(5)).toBe(2);
    expect(V.reserveGb(100)).toBe(15);
  });

  it('summarizes a budget with what is allocated and free', () => {
    expect(V.summarize(25, 6)).toEqual({ budgetGb: 25, reservedGb: 4, allocatedGb: 6, allocatableGb: 21, freeGb: 15 });
  });

  it('never reports negative free space', () => {
    expect(V.summarize(10, 50).freeGb).toBe(0);
  });

  it('treats a server with no budget as unmanaged', () => {
    expect(V.summarize(null, 12)).toEqual({ budgetGb: null, reservedGb: 0, allocatedGb: 12, allocatableGb: null, freeGb: null });
    expect(V.shortfall(null, 999, 999, 'edge-1')).toBeNull();
  });

  it('accepts a request that fits and explains one that does not', () => {
    expect(V.shortfall(25, 6, 15, 'edge-1')).toBeNull();
    const message = V.shortfall(25, 6, 16, 'edge-1');
    expect(message).toContain('16 GB does not fit on edge-1');
    expect(message).toContain('15 GB of its 21 GB');
  });

  it('validates a volume size', () => {
    expect(V.sizeError(10)).toBeNull();
    expect(V.sizeError(0)).toContain('at least');
    expect(V.sizeError(3000)).toContain('cannot exceed');
    expect(V.sizeError(1.5)).toContain('whole number');
  });

  it('validates a budget against the host disk and what services already use', () => {
    expect(V.budgetError(25, 0, 100)).toBeNull();
    expect(V.budgetError(3, 0, 100)).toContain('at least 5 GB');
    expect(V.budgetError(150, 0, 100)).toContain('only has 100 GB');
    expect(V.budgetError(25, 30, 100)).toContain('already use 30 GB');
    expect(V.budgetError(25, 0, null)).toBeNull();
  });
});
