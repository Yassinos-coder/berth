import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type IncomingMessage, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { AdvisorProviderClient, AdvisorProviderError } from './advisor-provider.client';

interface Seen {
  path: string;
  headers: IncomingMessage['headers'];
  body: Record<string, unknown>;
}

let server: Server;
let seen: Seen[];
let respond: (seen: Seen) => { status: number; body: unknown; delayMs?: number };
let base: string;

beforeEach(async () => {
  seen = [];
  respond = () => ({ status: 200, body: {} });
  server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => (raw += chunk));
    req.on('end', () => {
      const entry: Seen = { path: req.url ?? '', headers: req.headers, body: raw ? JSON.parse(raw) : {} };
      seen.push(entry);
      const reply = respond(entry);
      setTimeout(() => {
        res.writeHead(reply.status, { 'content-type': 'application/json' });
        res.end(typeof reply.body === 'string' ? reply.body : JSON.stringify(reply.body));
      }, reply.delayMs ?? 0);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => new Promise<void>((resolve) => server.close(() => resolve())));

const client = new AdvisorProviderClient();
const request = (overrides = {}) => ({
  wire: 'openai' as const,
  baseUrl: base,
  apiKey: 'sk-super-secret-key-1234',
  model: 'test-model',
  system: 'be brief',
  user: 'hello',
  maxTokens: 500,
  timeoutMs: 2000,
  ...overrides,
});

describe('AdvisorProviderClient (Anthropic)', () => {
  it('sends the Messages API request and reads text and usage', async () => {
    respond = () => ({ status: 200, body: { content: [{ type: 'text', text: '{"findings":[]}' }], usage: { input_tokens: 120, output_tokens: 30 } } });

    const result = await client.complete(request({ wire: 'anthropic' }));

    expect(result).toEqual({ text: '{"findings":[]}', tokensIn: 120, tokensOut: 30 });
    expect(seen[0].path).toBe('/v1/messages');
    expect(seen[0].headers['x-api-key']).toBe('sk-super-secret-key-1234');
    expect(seen[0].headers['anthropic-version']).toBe('2023-06-01');
    expect(seen[0].body).toMatchObject({ model: 'test-model', max_tokens: 500, system: 'be brief', messages: [{ role: 'user', content: 'hello' }] });
  });
});

describe('AdvisorProviderClient (OpenAI-compatible)', () => {
  it('sends a chat completion with a bearer token and reads text and usage', async () => {
    respond = () => ({ status: 200, body: { choices: [{ message: { content: 'hi' } }], usage: { prompt_tokens: 50, completion_tokens: 7 } } });

    const result = await client.complete(request());

    expect(result).toEqual({ text: 'hi', tokensIn: 50, tokensOut: 7 });
    expect(seen[0].path).toBe('/chat/completions');
    expect(seen[0].headers.authorization).toBe('Bearer sk-super-secret-key-1234');
    expect(seen[0].body.messages).toEqual([{ role: 'system', content: 'be brief' }, { role: 'user', content: 'hello' }]);
  });

  it('sends no authorization header for a local model without a key', async () => {
    respond = () => ({ status: 200, body: { choices: [{ message: { content: 'ok' } }] } });
    await client.complete(request({ apiKey: undefined }));
    expect(seen[0].headers.authorization).toBeUndefined();
  });

  it('retries with max_completion_tokens for models that require it', async () => {
    respond = (entry) =>
      'max_tokens' in entry.body
        ? { status: 400, body: { error: 'use max_completion_tokens' } }
        : { status: 200, body: { choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } } };

    const result = await client.complete(request());

    expect(result.text).toBe('ok');
    expect(seen).toHaveLength(2);
    expect(seen[1].body.max_completion_tokens).toBe(500);
  });

  it('treats a missing usage block as zero rather than failing', async () => {
    respond = () => ({ status: 200, body: { choices: [{ message: { content: 'ok' } }] } });
    expect(await client.complete(request())).toMatchObject({ tokensIn: 0, tokensOut: 0 });
  });
});

describe('AdvisorProviderClient errors', () => {
  it.each([
    [401, 'rejected the API key'],
    [403, 'does not have access'],
    [404, 'could not find that model'],
    [429, 'rate limiting'],
    [500, 'internal error'],
  ])('explains a %i without echoing the provider body or the key', async (status, expected) => {
    respond = () => ({ status, body: { error: { message: 'Incorrect API key provided: sk-super-secret-key-1234' } } });

    const error = await client.complete(request()).catch((e) => e);

    expect(error).toBeInstanceOf(AdvisorProviderError);
    expect(error.message).toContain(expected);
    expect(error.message).not.toContain('sk-super-secret');
  });

  it('times out slow providers', async () => {
    respond = () => ({ status: 200, body: {}, delayMs: 500 });
    const error = await client.complete(request({ timeoutMs: 100 })).catch((e) => e);
    expect(error.message).toContain('too long');
  });

  it('reports an unreachable provider', async () => {
    const error = await client.complete(request({ baseUrl: 'http://127.0.0.1:1' })).catch((e) => e);
    expect(error.message).toContain('Could not reach');
  });

  it('reports a reply it cannot read', async () => {
    respond = () => ({ status: 200, body: 'not json at all' });
    const error = await client.complete(request()).catch((e) => e);
    expect(error.message).toContain('could not read');
  });

  it('does not follow redirects, so a key is never forwarded elsewhere', async () => {
    server.removeAllListeners('request');
    server.on('request', (_req, res) => {
      res.writeHead(302, { location: 'http://127.0.0.1:1/steal' });
      res.end();
    });
    const error = await client.complete(request()).catch((e) => e);
    expect(error).toBeInstanceOf(AdvisorProviderError);
  });
});
