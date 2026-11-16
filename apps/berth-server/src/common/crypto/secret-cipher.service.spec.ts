import { describe, expect, it } from 'vitest';
import { createCipheriv, randomBytes, scryptSync } from 'node:crypto';
import type { ConfigService } from '@nestjs/config';
import { SecretCipher } from './secret-cipher.service';

function cipherFor(masterKey: string, previousMasterKeys: string[] = []) {
  const values: Record<string, unknown> = { masterKey, previousMasterKeys };
  return new SecretCipher({ get: (key: string) => values[key] } as ConfigService);
}

function legacyEncrypt(master: string, plaintext: string): string {
  const key = scryptSync(master, 'berth-secret-cipher-v1', 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

describe('SecretCipher', () => {
  it('round-trips and tags ciphertext with a key id', () => {
    const cipher = cipherFor('key-one');
    const payload = cipher.encrypt('hunter2');
    expect(payload.startsWith('v2:')).toBe(true);
    expect(cipher.decrypt(payload)).toBe('hunter2');
    expect(cipher.needsRotation(payload)).toBe(false);
  });

  it('reads secrets written under a previous key after rotation', () => {
    const payload = cipherFor('old-key').encrypt('token');
    const rotated = cipherFor('new-key', ['old-key']);
    expect(rotated.decrypt(payload)).toBe('token');
    expect(rotated.needsRotation(payload)).toBe(true);
    expect(cipherFor('new-key').decrypt(rotated.encrypt(rotated.decrypt(payload)))).toBe('token');
  });

  it('fails clearly when the previous key is not configured', () => {
    const payload = cipherFor('old-key').encrypt('token');
    expect(() => cipherFor('new-key').decrypt(payload)).toThrow(/BERTH_MASTER_KEY_PREVIOUS/);
  });

  it('still reads legacy v1 values and flags them for rotation', () => {
    const legacy = legacyEncrypt('key-one', 'old-secret');
    const cipher = cipherFor('key-one');
    expect(cipher.decrypt(legacy)).toBe('old-secret');
    expect(cipher.needsRotation(legacy)).toBe(true);
  });

  it('passes plaintext through and never flags it', () => {
    const cipher = cipherFor('key-one');
    expect(cipher.decrypt('plain')).toBe('plain');
    expect(cipher.needsRotation('plain')).toBe(false);
  });

  it('rejects tampered ciphertext', () => {
    const cipher = cipherFor('key-one');
    const parts = cipher.encrypt('secret').split(':');
    parts[4] = Buffer.from('tampered').toString('base64');
    expect(() => cipher.decrypt(parts.join(':'))).toThrow();
  });
});
