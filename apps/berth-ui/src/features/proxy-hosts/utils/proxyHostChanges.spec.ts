import { describe, expect, it } from 'vitest';
import { ProxyHostChanges } from './proxyHostChanges';
import type { ProxyHost } from '@/interfaces';

const host: ProxyHost = {
  id: 'h1',
  domain: 'app.example.com',
  path: '/',
  serviceId: 'svc-a',
  serviceName: 'web',
  targetPort: 3000,
  ssl: true,
  forceHttps: true,
  createdAt: '2026-11-01T00:00:00Z',
};

describe('ProxyHostChanges', () => {
  it('round-trips an unedited host to no changes', () => {
    expect(ProxyHostChanges.diff(host, ProxyHostChanges.toFormValues(host))).toEqual({});
  });

  it('shows the root path as empty in the form', () => {
    expect(ProxyHostChanges.toFormValues(host).path).toBe('');
    expect(ProxyHostChanges.toFormValues({ ...host, path: '/api' }).path).toBe('/api');
  });

  it('sends only what changed', () => {
    const values = { ...ProxyHostChanges.toFormValues(host), domain: ' New.Example.com ', targetPort: '8080' };
    expect(ProxyHostChanges.diff(host, values)).toEqual({ domain: 'new.example.com', targetPort: 8080 });
  });

  it('treats an emptied path as the whole domain', () => {
    const scoped = { ...host, path: '/api' };
    expect(ProxyHostChanges.diff(scoped, { ...ProxyHostChanges.toFormValues(scoped), path: '' })).toEqual({ path: '/' });
  });

  it('reports a move to another service', () => {
    const values = { ...ProxyHostChanges.toFormValues(host), serviceId: 'svc-b' };
    expect(ProxyHostChanges.diff(host, values)).toEqual({ serviceId: 'svc-b' });
  });

  it('turning HTTPS off also turns force-HTTPS off', () => {
    const values = { ...ProxyHostChanges.toFormValues(host), ssl: false };
    expect(ProxyHostChanges.diff(host, values)).toEqual({ ssl: false, forceHttps: false });
  });
});
