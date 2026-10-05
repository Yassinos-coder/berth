import { randomBytes } from 'node:crypto';

export class InternalDomainUtil {
  static generate(name: string): string {
    const slug =
      name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '') || 'service';
    return `${slug}-${randomBytes(3).toString('hex')}.berth.local`;
  }
}
