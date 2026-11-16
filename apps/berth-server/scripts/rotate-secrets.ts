import { PrismaClient } from '@prisma/client';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { ConfigService } from '@nestjs/config';
import { SecretCipher } from '../src/common/crypto/secret-cipher.service';

interface Delegate {
  findMany(args: { select: Record<string, boolean>; where?: object }): Promise<
    Array<Record<string, unknown>>
  >;
  update(args: { where: { id: string }; data: Record<string, string> }): Promise<unknown>;
}

interface Target {
  model: string;
  fields: string[];
  where?: object;
}

const TARGETS: Target[] = [
  { model: 'user', fields: ['totpSecret'] },
  { model: 'githubApp', fields: ['clientSecret', 'webhookSecret', 'privateKey'] },
  { model: 'notificationChannel', fields: ['smtpPasswordEncrypted'] },
  { model: 'registryCredential', fields: ['passwordEncrypted'] },
  { model: 'sourceCredential', fields: ['tokenEncrypted'] },
  { model: 'backupTarget', fields: ['secretAccessKeyEncrypted'] },
  { model: 'envVar', fields: ['value'], where: { isSecret: true } },
];

const dryRun = process.argv.includes('--dry-run');
const previous = (process.env.BERTH_MASTER_KEY_PREVIOUS ?? '')
  .split(',')
  .map((key) => key.trim())
  .filter(Boolean);

const values: Record<string, unknown> = {
  masterKey: process.env.BERTH_MASTER_KEY ?? '',
  previousMasterKeys: previous,
};
const cipher = new SecretCipher({ get: (key: string) => values[key] } as ConfigService);
const prisma = new PrismaClient();

async function rotateTable(target: Target): Promise<number> {
  const delegate = (prisma as unknown as Record<string, Delegate>)[target.model];
  const select = Object.fromEntries([['id', true], ...target.fields.map((f) => [f, true])]);
  const rows = await delegate.findMany({ select, where: target.where });
  let rotated = 0;
  for (const row of rows) {
    const data: Record<string, string> = {};
    for (const field of target.fields) {
      const stored = row[field];
      if (typeof stored !== 'string' || !cipher.needsRotation(stored)) continue;
      data[field] = cipher.encrypt(cipher.decrypt(stored));
    }
    if (Object.keys(data).length === 0) continue;
    rotated += 1;
    if (!dryRun) await delegate.update({ where: { id: String(row.id) }, data });
  }
  return rotated;
}

function rotateCaKey(): number {
  const keyPath = resolve(process.env.BERTH_CA_KEY_PATH ?? './certs/ca-key.pem');
  if (!existsSync(keyPath)) return 0;
  const stored = readFileSync(keyPath, 'utf8');
  if (!cipher.needsRotation(stored)) return 0;
  if (!dryRun) writeFileSync(keyPath, cipher.encrypt(cipher.decrypt(stored)), { mode: 0o600 });
  return 1;
}

async function main(): Promise<void> {
  if (!process.env.BERTH_MASTER_KEY) throw new Error('BERTH_MASTER_KEY is not set');
  let total = 0;
  for (const target of TARGETS) {
    const count = await rotateTable(target);
    total += count;
    console.log(`${target.model}: ${count} row(s) ${dryRun ? 'would be ' : ''}re-encrypted`);
  }
  const ca = rotateCaKey();
  total += ca;
  console.log(`panel CA key: ${ca} file ${dryRun ? 'would be ' : ''}re-encrypted`);
  console.log(
    dryRun
      ? `dry run: ${total} item(s) pending. Run again without --dry-run.`
      : `done: ${total} item(s) now use the current master key. BERTH_MASTER_KEY_PREVIOUS can be removed once a fresh backup exists.`,
  );
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
