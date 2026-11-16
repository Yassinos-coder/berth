import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
  scryptSync,
} from 'node:crypto';

const LEGACY_VERSION = 'v1';
const VERSION = 'v2';
const ALGO = 'aes-256-gcm';
const SALT = 'berth-secret-cipher-v1';
const IV_BYTES = 12;
const KEY_ID_HEX_CHARS = 8;

interface KeyringEntry {
  id: string;
  key: Buffer;
}

@Injectable()
export class SecretCipher {
  private readonly current: KeyringEntry;
  private readonly keyring: KeyringEntry[];

  constructor(config: ConfigService) {
    const master = config.get<string>('masterKey') ?? '';
    const previous = config.get<string[]>('previousMasterKeys') ?? [];
    this.current = SecretCipher.deriveEntry(master);
    this.keyring = [
      this.current,
      ...previous
        .filter((key) => key !== master)
        .map((key) => SecretCipher.deriveEntry(key)),
    ];
  }

  isEncrypted(value: string): boolean {
    return (
      value.startsWith(`${VERSION}:`) || value.startsWith(`${LEGACY_VERSION}:`)
    );
  }

  needsRotation(payload: string): boolean {
    if (!this.isEncrypted(payload)) return false;
    return !payload.startsWith(`${VERSION}:${this.current.id}:`);
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGO, this.current.key, iv);
    const ciphertext = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return [
      VERSION,
      this.current.id,
      iv.toString('base64'),
      tag.toString('base64'),
      ciphertext.toString('base64'),
    ].join(':');
  }

  decrypt(payload: string): string {
    if (!this.isEncrypted(payload)) return payload;
    const parts = payload.split(':');
    if (parts[0] === LEGACY_VERSION) {
      const [, iv, tag, data] = parts;
      return this.decryptWithAny(this.keyring, iv, tag, data);
    }
    const [, keyId, iv, tag, data] = parts;
    const entry = this.keyring.find((candidate) => candidate.id === keyId);
    if (!entry) {
      throw new Error(
        `secret was encrypted with unknown master key ${keyId}; set BERTH_MASTER_KEY_PREVIOUS`,
      );
    }
    return this.decryptWithAny([entry], iv, tag, data);
  }

  private decryptWithAny(
    candidates: KeyringEntry[],
    ivB64: string,
    tagB64: string,
    dataB64: string,
  ): string {
    const iv = Buffer.from(ivB64, 'base64');
    const tag = Buffer.from(tagB64, 'base64');
    const data = Buffer.from(dataB64, 'base64');
    let lastError: unknown;
    for (const candidate of candidates) {
      try {
        const decipher = createDecipheriv(ALGO, candidate.key, iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([
          decipher.update(data),
          decipher.final(),
        ]).toString('utf8');
      } catch (error) {
        lastError = error;
      }
    }
    throw lastError instanceof Error
      ? lastError
      : new Error('secret could not be decrypted with any known master key');
  }

  private static deriveEntry(master: string): KeyringEntry {
    const key = scryptSync(master, SALT, 32);
    const id = createHash('sha256')
      .update(key)
      .digest('hex')
      .slice(0, KEY_ID_HEX_CHARS);
    return { id, key };
  }
}
