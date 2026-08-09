#!/usr/bin/env node
import process from 'node:process';

const base = (process.env.BERTH_URL ?? 'http://localhost:4000').replace(/\/$/, '');
const token = process.env.BERTH_TOKEN ?? '';
const [command, ...args] = process.argv.slice(2);

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!token) throw new Error('BERTH_TOKEN is required');
  const response = await fetch(`${base}/api${path}`, { ...init, headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'X-Berth-Client': 'cli', ...init.headers } });
  if (!response.ok) throw new Error(`${response.status}: ${await response.text()}`);
  return response.status === 204 ? undefined as T : response.json() as Promise<T>;
}

function required(index: number, label: string): string {
  const value = args[index];
  if (!value) throw new Error(`${label} is required`);
  return value;
}

async function main(): Promise<void> {
  switch (command) {
    case 'deploy': {
      const id = required(0, 'service id');
      await request(`/services/${id}/redeploy`, { method: 'POST', body: '{}' });
      console.log(`Redeploy requested for ${id}`);
      return;
    }
    case 'logs': {
      const rows = await request<Array<{ ts: number; stream: string; line: string }>>(`/services/${required(0, 'service id')}/logs`);
      for (const row of rows) console.log(`${new Date(row.ts).toISOString()} ${row.stream.padEnd(7)} ${row.line}`);
      return;
    }
    case 'env': {
      const action = required(0, 'env action (get/set)');
      const id = required(1, 'service id');
      if (action === 'get') {
        const rows = await request<Array<{ key: string; value: string }>>(`/services/${id}/env`);
        for (const row of rows) console.log(`${row.key}=${row.value}`);
      } else if (action === 'set') {
        const existing = await request<Array<{ key: string; value: string; isSecret: boolean }>>(`/services/${id}/env`);
        const updates = args.slice(2).map((item) => { const split = item.indexOf('='); if (split < 1) throw new Error(`Invalid KEY=VALUE: ${item}`); return { key: item.slice(0, split), value: item.slice(split + 1), isSecret: true }; });
        const merged = new Map(existing.map((item) => [item.key, item]));
        updates.forEach((item) => merged.set(item.key, item));
        await request(`/services/${id}/env`, { method: 'PUT', body: JSON.stringify({ env: [...merged.values()] }) });
        console.log(`Updated ${updates.length} variable(s)`);
      } else throw new Error('env action must be get or set');
      return;
    }
    case 'shell': {
      const id = required(0, 'service id');
      const wsBase = base.replace(/^http/, 'ws');
      const protocol = `berth.token.${Buffer.from(token).toString('base64url')}`;
      const socket = new WebSocket(`${wsBase}/api/services/${encodeURIComponent(id)}/exec`, protocol);
      process.stdin.setRawMode?.(true); process.stdin.resume();
      socket.addEventListener('open', () => process.stdin.on('data', (data) => socket.send(JSON.stringify({ type: 'input', data: Buffer.from(data).toString('base64') }))));
      socket.addEventListener('message', (event) => { const msg = JSON.parse(String(event.data)) as { type: string; data?: string }; if (msg.type === 'ExecOutput' && msg.data) process.stdout.write(Buffer.from(msg.data, 'base64')); });
      socket.addEventListener('close', () => { process.stdin.setRawMode?.(false); process.exit(0); });
      socket.addEventListener('error', () => { process.stdin.setRawMode?.(false); console.error('Shell connection failed'); process.exit(1); });
      return;
    }
    default:
      console.log('Usage: berth <deploy|logs|shell|env> ...\n\nEnvironment: BERTH_URL, BERTH_TOKEN');
  }
}

main().catch((error: unknown) => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
