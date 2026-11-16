import { describe, expect, it } from 'vitest';
import { RequestIdUtil } from './request-id.util';

describe('RequestIdUtil', () => {
  const generate = () => 'generated-id-123';

  it('keeps a well-formed incoming id', () => {
    expect(RequestIdUtil.resolve('abc12345-def', generate)).toBe('abc12345-def');
  });

  it('uses the first value of a repeated header', () => {
    expect(RequestIdUtil.resolve(['abc12345', 'zzz'], generate)).toBe('abc12345');
  });

  it('replaces missing, short or unsafe ids', () => {
    expect(RequestIdUtil.resolve(undefined, generate)).toBe('generated-id-123');
    expect(RequestIdUtil.resolve('short', generate)).toBe('generated-id-123');
    expect(RequestIdUtil.resolve('bad id\nx-injected: 1', generate)).toBe(
      'generated-id-123',
    );
  });
});
