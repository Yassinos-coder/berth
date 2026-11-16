import { CLIENT_CERT_LIFETIME_DAYS } from '../pki/ca.service';

const DAY_MS = 24 * 60 * 60 * 1000;
const RENEW_WITHIN_DAYS = 120;
const LEGACY_LIFETIME_FACTOR = 1.5;

export class CertificateRenewalValidator {
  static shouldRenew(
    validFrom: string | undefined,
    validTo: string | undefined,
    now: Date,
  ): boolean {
    if (!validFrom || !validTo) return false;
    const from = Date.parse(validFrom);
    const to = Date.parse(validTo);
    if (Number.isNaN(from) || Number.isNaN(to)) return false;

    const remainingDays = (to - now.getTime()) / DAY_MS;
    if (remainingDays <= RENEW_WITHIN_DAYS) return true;

    const lifetimeDays = (to - from) / DAY_MS;
    return lifetimeDays > CLIENT_CERT_LIFETIME_DAYS * LEGACY_LIFETIME_FACTOR;
  }
}
