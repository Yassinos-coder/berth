import { Link } from 'react-router-dom';
import { ExternalLink, Loader2, Lock, Trash2, Unlock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { CopyButton } from '@/components/shared/CopyButton';
import { EditProxyHostDialog } from '@/features/proxy-hosts/EditProxyHostDialog';
import { ProxyHostUrl } from '@/features/proxy-hosts/utils/proxyHostUrl';
import { useRemoveProxyHost } from '@/hooks/useProxyHostsMutations';
import type { ProxyHost } from '@/interfaces';

export function ProxyHostCard({
  host,
  showService = true,
}: {
  host: ProxyHost;
  showService?: boolean;
}) {
  const remove = useRemoveProxyHost();
  const label = ProxyHostUrl.label(host);

  const content = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
      <div className="min-w-0 space-y-1">
        <div className="flex items-start gap-1">
          <a
            href={ProxyHostUrl.href(host)}
            target="_blank"
            rel="noreferrer"
            className="text-primary focus-visible:ring-ring/40 inline-flex min-w-0 items-start gap-1.5 rounded-sm font-medium break-all outline-none focus-visible:ring-[3px]"
            translate="no"
          >
            <span>{label}</span>
            <ExternalLink className="mt-1 size-3.5 shrink-0" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <CopyButton
            value={ProxyHostUrl.href(host)}
            ariaLabel={`Copy link to ${label}`}
            className="text-muted-foreground size-7 shrink-0 border-transparent shadow-none"
          />
        </div>
        <p className="text-muted-foreground text-xs" translate="no">
          {showService ? (
            <>
              →{' '}
              <Link
                to={`/services/${host.serviceId}`}
                className="hover:text-foreground underline-offset-2 hover:underline"
              >
                {host.serviceName}
              </Link>
              :{host.targetPort}
            </>
          ) : (
            <>→ port {host.targetPort}</>
          )}
          {host.ssl && host.forceHttps ? (
            <span className="font-sans"> · redirects HTTP to HTTPS</span>
          ) : null}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <Badge
          variant={host.ssl ? 'default' : 'secondary'}
          className="mr-1 gap-1"
        >
          {host.ssl ? (
            <Lock className="size-3" aria-hidden="true" />
          ) : (
            <Unlock className="size-3" aria-hidden="true" />
          )}
          {host.ssl ? 'HTTPS' : 'HTTP'}
        </Badge>
        <EditProxyHostDialog host={host} />
        <ConfirmDialog
          trigger={
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              disabled={remove.isPending}
              aria-label={`Delete proxy host ${label}`}
            >
              {remove.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Trash2 className="size-4" aria-hidden="true" />
              )}
            </Button>
          }
          title={`Delete ${label}?`}
          description={
            <>
              Caddy stops routing this {host.path === '/' ? 'domain' : 'path'}{' '}
              to <span translate="no">{host.serviceName}</span> as soon as the
              agent reconciles. The certificate is kept.
            </>
          }
          confirmLabel="Delete Proxy Host"
          isPending={remove.isPending}
          onConfirm={() => remove.mutate(host.id)}
        />
      </div>
    </div>
  );

  if (!showService) {
    return <div className="rounded-lg border p-3">{content}</div>;
  }

  return (
    <Card>
      <CardContent>{content}</CardContent>
    </Card>
  );
}
