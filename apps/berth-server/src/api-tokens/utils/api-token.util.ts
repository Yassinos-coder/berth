import { createHash, randomBytes } from 'node:crypto';

const TOKEN_PREFIX = 'brth_';
const TOKEN_BYTES = 24;
const DISPLAY_PREFIX_LENGTH = 12;

export interface GeneratedApiToken {
  token: string;
  tokenHash: string;
  tokenPrefix: string;
}

export class ApiTokenGenerator {
  static generate(): GeneratedApiToken {
    const token = `${TOKEN_PREFIX}${randomBytes(TOKEN_BYTES).toString('base64url')}`;
    return {
      token,
      tokenHash: this.hash(token),
      tokenPrefix: token.slice(0, DISPLAY_PREFIX_LENGTH),
    };
  }

  static hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  static isApiToken(token: string): boolean {
    return token.startsWith(TOKEN_PREFIX);
  }
}
