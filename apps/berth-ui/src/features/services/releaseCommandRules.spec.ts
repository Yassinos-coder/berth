import { describe, expect, it } from 'vitest';
import { ReleaseCommandRules } from '@/features/services/releaseCommandRules';

describe('ReleaseCommandRules', () => {
  it('accepts an empty or normal single-line command', () => {
    expect(ReleaseCommandRules.error('')).toBeNull();
    expect(ReleaseCommandRules.error('npx prisma migrate deploy && node seed.js')).toBeNull();
  });

  it('rejects multi-line and oversized commands', () => {
    expect(ReleaseCommandRules.error('a\nb')).toMatch(/single line/);
    expect(ReleaseCommandRules.error('x'.repeat(2001))).toMatch(/at most/);
  });
});
