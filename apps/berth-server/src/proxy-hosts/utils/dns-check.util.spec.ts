import { describe, expect, it } from 'vitest';
import { DnsCheckUtil } from './dns-check.util';

describe('DnsCheckUtil.isPublicIp', () => {
  it.each(['8.8.8.8', '203.0.113.7', '172.32.0.1', '100.63.0.1', '2606:4700::1111'])('treats %s as public', (ip) => {
    expect(DnsCheckUtil.isPublicIp(ip)).toBe(true);
  });

  it.each([
    '10.0.0.5',
    '127.0.0.1',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.1.1',
    '169.254.1.1',
    '100.64.0.1',
    '0.0.0.0',
    '::1',
    'fd12::1',
    'fe80::1',
    '',
    'nonsense',
    '300.1.1.1',
  ])('treats %j as not public', (ip) => {
    expect(DnsCheckUtil.isPublicIp(ip)).toBe(false);
  });

  it('handles missing values', () => {
    expect(DnsCheckUtil.isPublicIp(undefined)).toBe(false);
    expect(DnsCheckUtil.isPublicIp(null)).toBe(false);
  });
});

describe('DnsCheckUtil.evaluate', () => {
  it('is ok when any record matches the server', () => {
    const result = DnsCheckUtil.evaluate('a.example.com', ['1.2.3.4', '203.0.113.7'], '203.0.113.7');
    expect(result.status).toBe('ok');
  });

  it('flags a different address', () => {
    const result = DnsCheckUtil.evaluate('a.example.com', ['1.2.3.4'], '203.0.113.7');
    expect(result.status).toBe('mismatch');
    expect(result.message).toContain('1.2.3.4');
    expect(result.message).toContain('203.0.113.7');
  });

  it('reports a missing record with the address to use', () => {
    const result = DnsCheckUtil.evaluate('a.example.com', [], '203.0.113.7');
    expect(result.status).toBe('unresolved');
    expect(result.message).toContain('203.0.113.7');
  });

  it('cannot confirm when the server address is private or unknown', () => {
    expect(DnsCheckUtil.evaluate('a.example.com', ['1.2.3.4'], '10.0.0.5').status).toBe('unknown');
    expect(DnsCheckUtil.evaluate('a.example.com', ['1.2.3.4'], '').status).toBe('unknown');
    expect(DnsCheckUtil.evaluate('a.example.com', ['1.2.3.4'], undefined).expectedIp).toBeUndefined();
  });

  it('still reports unresolved when the server address is unknown', () => {
    const result = DnsCheckUtil.evaluate('a.example.com', [], null);
    expect(result.status).toBe('unresolved');
    expect(result.expectedIp).toBeUndefined();
  });
});
