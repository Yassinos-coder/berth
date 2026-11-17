import { Link } from 'react-router-dom';
import { ExternalLink, Globe, Settings2 } from 'lucide-react';
import { ProxyHostUrl } from '@/features/proxy-hosts/utils/proxyHostUrl';
import type { ProxyHost } from '@/interfaces';

interface DomainItem {
  key: string;
  label: string;
  href: string;
}

export function ServiceDomainLinks({
  hosts,
  legacyDomain,
  canExposePublicly,
}: {
  hosts: ProxyHost[];
  legacyDomain?: string;
  canExposePublicly: boolean;
}) {
  const items: DomainItem[] =
    hosts.length > 0
      ? hosts.map((host) => ({
          key: host.id,
          label: ProxyHostUrl.label(host),
          href: ProxyHostUrl.href(host),
        }))
      : legacyDomain
        ? [
            {
              key: legacyDomain,
              label: legacyDomain,
              href: ProxyHostUrl.legacyHref(legacyDomain),
            },
          ]
        : [];

  if (items.length === 0) {
    if (!canExposePublicly) return null;
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-sm">
        <Globe className="size-4 shrink-0" aria-hidden="true" />
        Not reachable from the internet yet.
        <Link
          to="?tab=domains"
          className="text-primary underline-offset-2 hover:underline"
        >
          Add a domain
        </Link>
      </p>
    );
  }

  return (
    <div
      className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm"
      data-testid="service-domains"
    >
      <Globe className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
      {items.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noreferrer"
          translate="no"
          className="text-primary inline-flex items-center gap-1 font-medium hover:underline"
        >
          {item.label}
          <ExternalLink className="size-3.5" aria-hidden="true" />
          <span className="sr-only">(opens in a new tab)</span>
        </a>
      ))}
      <Link
        to="?tab=domains"
        className="text-muted-foreground hover:text-foreground inline-flex items-center gap-1 text-xs"
      >
        <Settings2 className="size-3.5" aria-hidden="true" />
        Manage domains
      </Link>
    </div>
  );
}
