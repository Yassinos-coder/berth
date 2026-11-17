import { describe, expect, it } from 'vitest';
import { CaDownloadValidator } from './ca-download.validator';

const PEM = '-----BEGIN CERTIFICATE-----\nabc\n-----END CERTIFICATE-----\n';

describe('CaDownloadValidator', () => {
  it('serves the public CA certificate at /ca.pem', () => {
    const response = CaDownloadValidator.respond('GET', '/ca.pem', PEM);
    expect(response.status).toBe(200);
    expect(response.body).toBe(PEM);
    expect(response.contentType).toContain('pem');
  });

  it('ignores a query string', () => {
    expect(CaDownloadValidator.respond('GET', '/ca.pem?x=1', PEM).status).toBe(200);
  });

  it('serves nothing else, so the gateway exposes no other surface', () => {
    expect(CaDownloadValidator.respond('GET', '/', PEM).status).toBe(404);
    expect(CaDownloadValidator.respond('GET', '/agent', PEM).status).toBe(404);
    expect(CaDownloadValidator.respond('GET', '/ca.pem/../x', PEM).status).toBe(404);
  });

  it('is read-only', () => {
    expect(CaDownloadValidator.respond('POST', '/ca.pem', PEM).status).toBe(405);
  });
});
