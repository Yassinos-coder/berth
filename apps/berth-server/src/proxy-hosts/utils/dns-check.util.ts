import type { DnsCheckDto } from '../interfaces/dns-check';

export class DnsCheckUtil {
  static isPublicIp(ip: string | undefined | null): boolean {
    if (!ip) return false;
    const value = ip.trim().toLowerCase();
    if (value.includes(':')) {
      return !(
        value === '::1' ||
        value === '::' ||
        value.startsWith('fc') ||
        value.startsWith('fd') ||
        value.startsWith('fe80')
      );
    }

    const parts = value.split('.').map(Number);
    if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) {
      return false;
    }
    const [a, b] = parts;
    if (a === 0 || a === 10 || a === 127) return false;
    if (a === 169 && b === 254) return false;
    if (a === 172 && b >= 16 && b <= 31) return false;
    if (a === 192 && b === 168) return false;
    if (a === 100 && b >= 64 && b <= 127) return false;
    return true;
  }

  static evaluate(domain: string, resolved: string[], expectedIp?: string | null): DnsCheckDto {
    const expected = this.isPublicIp(expectedIp) ? expectedIp!.trim() : undefined;

    if (resolved.length === 0) {
      return {
        status: 'unresolved',
        domain,
        expectedIp: expected,
        resolved,
        message: expected
          ? `No DNS record found for ${domain} yet. Add an A record pointing to ${expected}. HTTPS cannot be issued until it resolves.`
          : `No DNS record found for ${domain} yet. HTTPS cannot be issued until it resolves.`,
      };
    }

    if (!expected) {
      return {
        status: 'unknown',
        domain,
        resolved,
        message: `${domain} resolves to ${resolved.join(', ')}. Berth does not know this server's public IP, so it cannot confirm they match.`,
      };
    }

    if (resolved.includes(expected)) {
      return {
        status: 'ok',
        domain,
        expectedIp: expected,
        resolved,
        message: `${domain} points to this server.`,
      };
    }

    return {
      status: 'mismatch',
      domain,
      expectedIp: expected,
      resolved,
      message: `${domain} resolves to ${resolved.join(', ')}, not this server (${expected}). Update the A record, or ignore this if a proxy such as Cloudflare sits in front.`,
    };
  }
}
