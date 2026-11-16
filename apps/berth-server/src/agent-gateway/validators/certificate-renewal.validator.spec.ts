import { describe, expect, it } from 'vitest';
import { CertificateRenewalValidator } from './certificate-renewal.validator';

const now = new Date('2026-11-16T00:00:00Z');

describe('CertificateRenewalValidator', () => {
  it('leaves a fresh one-year certificate alone', () => {
    expect(
      CertificateRenewalValidator.shouldRenew('2026-10-01T00:00:00Z', '2027-10-01T00:00:00Z', now),
    ).toBe(false);
  });

  it('renews when the certificate is close to expiry', () => {
    expect(
      CertificateRenewalValidator.shouldRenew('2026-01-01T00:00:00Z', '2027-01-01T00:00:00Z', now),
    ).toBe(true);
  });

  it('migrates legacy long-lived certificates to the shorter lifetime', () => {
    expect(
      CertificateRenewalValidator.shouldRenew('2026-10-01T00:00:00Z', '2031-10-01T00:00:00Z', now),
    ).toBe(true);
  });

  it('does nothing when dates are missing or unreadable', () => {
    expect(CertificateRenewalValidator.shouldRenew(undefined, undefined, now)).toBe(false);
    expect(CertificateRenewalValidator.shouldRenew('x', 'y', now)).toBe(false);
  });
});
