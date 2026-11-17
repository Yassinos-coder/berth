import { describe, expect, it } from 'vitest';
import { ProviderUrlValidator as V } from './provider-url.validator';

describe('ProviderUrlValidator', () => {
  it('accepts https providers and trims the trailing slash', () => {
    expect(V.check('https://api.example.com/v1/')).toEqual({ ok: true, url: 'https://api.example.com/v1' });
  });

  it('allows plain http only for a model on your own machine or network', () => {
    expect(V.check('http://localhost:11434/v1').ok).toBe(true);
    expect(V.check('http://127.0.0.1:8080').ok).toBe(true);
    expect(V.check('http://192.168.1.20:11434/v1').ok).toBe(true);
    expect(V.check('http://10.0.0.5/v1').ok).toBe(true);
    expect(V.check('http://172.20.1.1/v1').ok).toBe(true);
  });

  it('refuses http to the public internet so the key is never sent in clear text', () => {
    const result = V.check('http://api.example.com/v1');
    expect(result.ok).toBe(false);
    expect(result.error).toContain('https://');
    expect(V.check('http://172.32.0.1').ok).toBe(false);
  });

  it('blocks cloud metadata and link-local addresses', () => {
    for (const url of ['http://169.254.169.254/latest', 'https://169.254.10.10', 'https://metadata.google.internal', 'http://0.0.0.0']) {
      expect(V.check(url).ok, url).toBe(false);
    }
  });

  it('rejects credentials in the URL, other schemes, and garbage', () => {
    expect(V.check('https://user:pass@api.example.com').error).toContain('credentials');
    expect(V.check('ftp://example.com').ok).toBe(false);
    expect(V.check('not a url').ok).toBe(false);
    expect(V.check('   ').ok).toBe(false);
  });

  it('drops query strings and fragments', () => {
    expect(V.check('https://api.example.com/v1?key=abc#x')).toEqual({ ok: true, url: 'https://api.example.com/v1' });
  });
});
