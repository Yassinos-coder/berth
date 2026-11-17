import { generateSecret, generateURI, verifySync } from 'otplib';

export class TotpUtil {
  static generateSecret(): string {
    return generateSecret();
  }

  static keyUri(account: string, issuer: string, secret: string): string {
    return generateURI({ strategy: 'totp', issuer, label: account, secret });
  }

  static check(code: string, secret: string): boolean {
    try {
      return verifySync({ strategy: 'totp', secret, token: code }).valid;
    } catch {
      return false;
    }
  }
}
