import { createHash, randomBytes } from 'node:crypto';

export interface GeneratedOpaqueToken {
  token: string;
  tokenHash: string;
}

export class OpaqueTokenGenerator {
  static generate(bytes = 32): GeneratedOpaqueToken {
    const token = randomBytes(bytes).toString('base64url');
    return { token, tokenHash: this.hash(token) };
  }

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }
}
