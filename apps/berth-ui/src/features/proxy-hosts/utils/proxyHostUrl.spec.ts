import { describe, expect, it } from 'vitest';
import { ProxyHostUrl } from './proxyHostUrl';

describe('ProxyHostUrl', () => {
  it('omits the root path from the label', () => {
    expect(ProxyHostUrl.label({ domain: 'app.example.com', path: '/' })).toBe('app.example.com');
    expect(ProxyHostUrl.label({ domain: 'app.example.com', path: '/api' })).toBe('app.example.com/api');
  });

  it('follows the HTTPS setting in links', () => {
    expect(ProxyHostUrl.href({ domain: 'a.example.com', path: '/', ssl: true })).toBe('https://a.example.com');
    expect(ProxyHostUrl.href({ domain: 'a.example.com', path: '/v1', ssl: false })).toBe('http://a.example.com/v1');
  });

  it('links legacy single-domain services over HTTPS', () => {
    expect(ProxyHostUrl.legacyHref('old.example.com')).toBe('https://old.example.com');
  });

  it('previews what a visitor will open, even half typed', () => {
    expect(ProxyHostUrl.preview({ domain: '', path: '', ssl: true })).toBe('https://your-domain.com');
    expect(ProxyHostUrl.preview({ domain: ' app.example.com ', path: 'api', ssl: true })).toBe('https://app.example.com/api');
    expect(ProxyHostUrl.preview({ domain: 'app.example.com', path: '/', ssl: false })).toBe('http://app.example.com');
  });
});
