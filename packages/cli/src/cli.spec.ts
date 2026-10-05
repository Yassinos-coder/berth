import { afterEach, describe, expect, it, vi } from 'vitest';
import { BerthApiClient } from '@/api/berth-api.client';
import type { ServiceSummary } from '@/interfaces';
import { ShellSession } from '@/shell/shell-session';
import { FormatUtil } from '@/utils/format.util';
import { ServiceResolverUtil } from '@/utils/service-resolver.util';

const service = (id: string, name: string): ServiceSummary => ({
  id,
  name,
  kind: 'git',
  state: 'running',
  serverName: 'vps',
  source: { kind: 'git', repo: 'a/b', branch: 'main' },
});

const services = [service('c1abc', 'web'), service('c2def', 'web-pr-3'), service('c3ghi', 'api')];

describe('ServiceResolverUtil', () => {
  it('prefers an exact id', () => {
    expect(ServiceResolverUtil.resolve(services, 'c2def').name).toBe('web-pr-3');
  });

  it('prefers an exact name over a longer prefix match', () => {
    expect(ServiceResolverUtil.resolve(services, 'web').id).toBe('c1abc');
    expect(ServiceResolverUtil.resolve(services, 'WEB').id).toBe('c1abc');
  });

  it('accepts a unique prefix', () => {
    expect(ServiceResolverUtil.resolve(services, 'ap').name).toBe('api');
  });

  it('rejects ambiguous and unknown references', () => {
    expect(() => ServiceResolverUtil.resolve(services, 'c')).toThrow(/ambiguous/);
    expect(() => ServiceResolverUtil.resolve(services, 'nope')).toThrow(/No service/);
    expect(() => ServiceResolverUtil.resolve(services, '  ')).toThrow(/required/);
  });

  it('rejects duplicate exact names', () => {
    const dupes = [service('1', 'x'), service('2', 'x')];
    expect(() => ServiceResolverUtil.resolve(dupes, 'x')).toThrow(/matches 2/);
  });
});

describe('FormatUtil', () => {
  it('aligns table columns', () => {
    expect(FormatUtil.table(['A', 'BB'], [['long', '1'], ['x', '22']])).toBe('A     BB\nlong  1\nx     22');
  });

  it('masks only secrets', () => {
    expect(
      FormatUtil.maskSecrets([
        { key: 'A', value: 'plain', isSecret: false },
        { key: 'B', value: 'hush', isSecret: true },
      ]),
    ).toEqual([
      { key: 'A', value: 'plain', isSecret: false },
      { key: 'B', value: '********', isSecret: true },
    ]);
  });

  it('keeps equals signs inside values', () => {
    expect(FormatUtil.parseAssignment('URL=http://x?a=1')).toEqual({ key: 'URL', value: 'http://x?a=1' });
    expect(() => FormatUtil.parseAssignment('nokey')).toThrow();
    expect(() => FormatUtil.parseAssignment('=v')).toThrow();
  });

  it('normalizes panel urls', () => {
    expect(FormatUtil.normalizeUrl('https://p.example.com/')).toBe('https://p.example.com');
    expect(FormatUtil.normalizeUrl('https://p.example.com/api')).toBe('https://p.example.com');
    expect(() => FormatUtil.normalizeUrl('p.example.com')).toThrow();
  });

  it('strips ansi colours and carriage returns from logs', () => {
    expect(FormatUtil.cleanLog('\u001b[31mred\u001b[0m\r')).toBe('red');
  });
});

describe('BerthApiClient', () => {
  afterEach(() => vi.unstubAllGlobals());

  const config = { url: 'https://p.example.com', token: 'berth_abc' };

  const respond = (status: number, body: unknown) =>
    vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status, statusText: 'X' }));

  it('sends the bearer token and csrf header', async () => {
    const fetchMock = respond(200, []);
    vi.stubGlobal('fetch', fetchMock);
    await new BerthApiClient(config).listServices();
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://p.example.com/api/services');
    expect(init.headers.Authorization).toBe('Bearer berth_abc');
    expect(init.headers['X-Berth-Client']).toBe('cli');
  });

  it('posts actions to the service route', async () => {
    const fetchMock = respond(201, {});
    vi.stubGlobal('fetch', fetchMock);
    await new BerthApiClient(config).serviceAction('abc', 'redeploy');
    expect(fetchMock.mock.calls[0][0]).toBe('https://p.example.com/api/services/abc/redeploy');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
  });

  it('wraps env updates', async () => {
    const fetchMock = respond(200, []);
    vi.stubGlobal('fetch', fetchMock);
    await new BerthApiClient(config).setEnv('abc', [{ key: 'A', value: '1', isSecret: false }]);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      env: [{ key: 'A', value: '1', isSecret: false }],
    });
  });

  it('surfaces api error messages', async () => {
    vi.stubGlobal('fetch', respond(403, { message: 'Insufficient role' }));
    await expect(new BerthApiClient(config).listServices()).rejects.toThrow('Forbidden: Insufficient role');
  });

  it('explains an unreachable panel', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNREFUSED')));
    await expect(new BerthApiClient(config).listServices()).rejects.toThrow(/Could not reach/);
  });
});

describe('ShellSession', () => {
  it('derives the websocket url from the panel url', () => {
    expect(ShellSession.url({ url: 'https://p.example.com', token: 't' }, 'a b')).toBe(
      'wss://p.example.com/api/services/a%20b/exec',
    );
    expect(ShellSession.url({ url: 'http://localhost:4000', token: 't' }, 'x')).toBe(
      'ws://localhost:4000/api/services/x/exec',
    );
  });

  it('encodes the token as a base64url subprotocol', () => {
    expect(ShellSession.protocol('berth_a/b?c')).toBe(`berth.token.${Buffer.from('berth_a/b?c').toString('base64url')}`);
    expect(ShellSession.protocol('berth_a/b?c')).not.toMatch(/[+/=]/);
  });

  it('round-trips keystrokes and decodes terminal output', () => {
    const frame = JSON.parse(ShellSession.encodeInput(Buffer.from('ls')));
    expect(frame).toEqual({ type: 'input', data: Buffer.from('ls').toString('base64') });

    const output = JSON.stringify({ type: 'ExecOutput', data: Buffer.from('hello').toString('base64') });
    expect(ShellSession.decode(output)?.toString()).toBe('hello');
  });

  it('ignores frames that are not terminal output', () => {
    expect(ShellSession.decode('not json')).toBeNull();
    expect(ShellSession.decode(JSON.stringify({ type: 'ExecExit' }))).toBeNull();
    expect(ShellSession.decode(JSON.stringify({ type: 'ExecOutput' }))).toBeNull();
  });

  it('formats resize frames', () => {
    expect(JSON.parse(ShellSession.encodeResize(120, 40))).toEqual({ type: 'resize', cols: 120, rows: 40 });
  });
});
