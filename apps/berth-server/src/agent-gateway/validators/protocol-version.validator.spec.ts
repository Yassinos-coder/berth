import { describe, expect, it } from 'vitest';
import { PROTOCOL_VERSION } from '@berth/protocol';
import { ProtocolVersionValidator } from './protocol-version.validator';

describe('ProtocolVersionValidator', () => {
  it('accepts the current version and agents that send none', () => {
    expect(ProtocolVersionValidator.check(String(PROTOCOL_VERSION))).toBeNull();
    expect(ProtocolVersionValidator.check(null)).toBeNull();
  });

  it('rejects malformed versions', () => {
    expect(ProtocolVersionValidator.check('abc')).toBe('invalid protocol version');
    expect(ProtocolVersionValidator.check('0')).toBe('invalid protocol version');
    expect(ProtocolVersionValidator.check('1.5')).toBe('invalid protocol version');
  });

  it('rejects agents newer than the panel', () => {
    expect(ProtocolVersionValidator.check(String(PROTOCOL_VERSION + 1))).toContain(
      'newer than the panel',
    );
  });
});
