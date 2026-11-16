import { describe, expect, it } from 'vitest';
import { AgentIdentityValidator } from './agent-identity.validator';

const enrolled = { certSerial: 'ab12cd', pendingCertSerial: null, bootstrapToken: null };

describe('AgentIdentityValidator', () => {
  it('accepts the certificate recorded at enrollment, ignoring case and padding', () => {
    expect(AgentIdentityValidator.check(enrolled, 'AB12CD')).toBeNull();
    expect(AgentIdentityValidator.check(enrolled, '00AB12CD')).toBeNull();
  });

  it('rejects servers that no longer exist', () => {
    expect(AgentIdentityValidator.check(null, 'ab12cd')).toBe('unknown server');
  });

  it('rejects a superseded certificate', () => {
    expect(AgentIdentityValidator.check(enrolled, 'ffffff')).toContain('superseded');
  });

  it('rejects every certificate while re-enrollment is pending', () => {
    expect(
      AgentIdentityValidator.check({ ...enrolled, bootstrapToken: 'tok' }, 'ab12cd'),
    ).toContain('re-enrollment pending');
  });

  it('keeps legacy servers without a recorded serial connected', () => {
    expect(
      AgentIdentityValidator.check({ certSerial: null, pendingCertSerial: null, bootstrapToken: null }, 'ab12cd'),
    ).toBeNull();
  });

  it('accepts both the current and a freshly issued certificate during renewal', () => {
    const renewing = { ...enrolled, pendingCertSerial: 'beef01' };
    expect(AgentIdentityValidator.check(renewing, 'ab12cd')).toBeNull();
    expect(AgentIdentityValidator.check(renewing, 'BEEF01')).toBeNull();
    expect(AgentIdentityValidator.matchesPending(renewing, 'beef01')).toBe(true);
    expect(AgentIdentityValidator.matchesPending(renewing, 'ab12cd')).toBe(false);
    expect(AgentIdentityValidator.check(renewing, 'ffffff')).toContain('superseded');
  });
});
