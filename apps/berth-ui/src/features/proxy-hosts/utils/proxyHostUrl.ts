import type { ProxyHost } from '@/interfaces';

type HostLike = Pick<ProxyHost, 'domain' | 'path'>;

export class ProxyHostUrl {
  static label(host: HostLike): string {
    return `${host.domain}${host.path === '/' ? '' : host.path}`;
  }

  static href(host: HostLike & Pick<ProxyHost, 'ssl'>): string {
    return `${host.ssl ? 'https' : 'http'}://${ProxyHostUrl.label(host)}`;
  }

  static legacyHref(domain: string): string {
    return `https://${domain}`;
  }

  static preview(values: { domain: string; path: string; ssl: boolean }): string {
    const domain = values.domain.trim() || 'your-domain.com';
    const path = values.path.trim();
    const normalized = !path || path === '/' ? '' : path.startsWith('/') ? path : `/${path}`;
    return `${values.ssl ? 'https' : 'http'}://${domain}${normalized}`;
  }
}
