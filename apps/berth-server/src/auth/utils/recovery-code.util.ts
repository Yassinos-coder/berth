import { randomInt } from 'node:crypto';

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_COUNT = 8;
const CHARS_PER_CODE = 8;

export class RecoveryCodeGenerator {
  static generate(count = CODE_COUNT): string[] {
    return Array.from({ length: count }, () => this.generateOne());
  }

  private static generateOne(): string {
    const chars = Array.from(
      { length: CHARS_PER_CODE },
      () => ALPHABET[randomInt(ALPHABET.length)],
    );
    return `${chars.slice(0, 4).join('')}-${chars.slice(4).join('')}`;
  }
}
