import { describe, expect, it } from 'vitest';
import { generateSync } from 'otplib';
import { TotpUtil } from './totp.util';

describe('TotpUtil', () => {
  it('accepts the current code for a generated secret', () => {
    const secret = TotpUtil.generateSecret();
    const code = generateSync({ strategy: 'totp', secret });
    expect(TotpUtil.check(code, secret)).toBe(true);
  });

  it('rejects a wrong code, a malformed code and a different secret', () => {
    const secret = TotpUtil.generateSecret();
    const code = generateSync({ strategy: 'totp', secret });
    const wrong = code === '000000' ? '000001' : '000000';
    expect(TotpUtil.check(wrong, secret)).toBe(false);
    expect(TotpUtil.check('abc', secret)).toBe(false);
    expect(TotpUtil.check(code, TotpUtil.generateSecret())).toBe(false);
  });

  it('builds an otpauth URI for authenticator apps', () => {
    const uri = TotpUtil.keyUri('me@example.com', 'Berth', TotpUtil.generateSecret());
    expect(uri.startsWith('otpauth://totp/')).toBe(true);
    expect(uri).toContain('issuer=Berth');
  });
});
