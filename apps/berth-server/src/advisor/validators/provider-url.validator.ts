export interface ProviderUrlResult {
  ok: boolean;
  url?: string;
  error?: string;
}

const BLOCKED_HOSTS = new Set([
  'metadata.google.internal',
  'metadata',
  'instance-data',
  '169.254.169.254',
  '0.0.0.0',
]);

function isLoopback(host: string): boolean {
  return host === 'localhost' || host === '127.0.0.1' || host === '::1' || host === '[::1]';
}

function isPrivateIpv4(host: string): boolean {
  const match = /^(\d+)\.(\d+)\.(\d+)\.(\d+)$/.exec(host);
  if (!match) return false;
  const [a, b] = [Number(match[1]), Number(match[2])];
  return a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isLinkLocal(host: string): boolean {
  return /^169\.254\./.test(host) || host.toLowerCase().startsWith('fe80:') || host.toLowerCase().startsWith('[fe80:');
}

export class ProviderUrlValidator {
  static check(raw: string): ProviderUrlResult {
    const value = raw.trim();
    if (!value) return { ok: false, error: 'Enter the provider URL.' };

    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      return { ok: false, error: 'That is not a valid URL.' };
    }
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return { ok: false, error: 'The URL must start with https:// or http://.' };
    }
    if (parsed.username || parsed.password) {
      return { ok: false, error: 'Do not put credentials in the URL. Use the API key field.' };
    }

    const host = parsed.hostname.toLowerCase();
    if (BLOCKED_HOSTS.has(host) || isLinkLocal(host)) {
      return { ok: false, error: 'That address is not allowed.' };
    }
    const local = isLoopback(host) || isPrivateIpv4(host);
    if (parsed.protocol === 'http:' && !local) {
      return { ok: false, error: 'Use https:// for any provider that is not on your own machine or network, so your key is encrypted in transit.' };
    }

    parsed.hash = '';
    parsed.search = '';
    return { ok: true, url: parsed.toString().replace(/\/+$/, '') };
  }
}
