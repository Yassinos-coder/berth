import { ExternalLink, Loader2, Lock, Trash2, Unlock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { useRemoveProxyHost } from '@/hooks/useProxyHostsMutations';
import type { ProxyHost } from '@/interfaces';

export function ProxyHostCard({ host }: { host: ProxyHost }) {
  const remove = useRemoveProxyHost();
  const scheme = host.ssl ? 'https' : 'http';

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4">
        <div className="min-w-0 space-y-1">
          <a
            href={`${scheme}://${host.domain}`}
            target="_blank"
            rel="noreferrer"
            className="text-primary focus-visible:ring-ring/40 inline-flex items-center gap-1.5 rounded-sm font-medium outline-none focus-visible:ring-[3px]"
            translate="no"
          >
            {host.domain}
            <ExternalLink className="size-3.5" aria-hidden="true" />
            <span className="sr-only">(opens in a new tab)</span>
          </a>
          <p className="text-muted-foreground truncate text-xs" translate="no">
            → {host.serviceName}:{host.targetPort}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={host.ssl ? 'default' : 'secondary'} className="gap-1">
            {host.ssl ? (
              <Lock className="size-3" aria-hidden="true" />
            ) : (
              <Unlock className="size-3" aria-hidden="true" />
            )}
            {host.ssl ? 'HTTPS' : 'HTTP'}
          </Badge>
          <ConfirmDialog
            trigger={
              <Button
                variant="ghost"
                size="icon"
                className="text-muted-foreground hover:text-destructive"
                disabled={remove.isPending}
                aria-label={`Delete proxy host ${host.domain}`}
              >
                {remove.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Trash2 className="size-4" aria-hidden="true" />
                )}
              </Button>
            }
            title={`Delete ${host.domain}?`}
            description={
              <>
                Caddy stops routing this domain to{' '}
                <span translate="no">{host.serviceName}</span> as soon as the
                agent reconciles. The certificate is kept.
              </>
            }
            confirmLabel="Delete Proxy Host"
            isPending={remove.isPending}
            onConfirm={() => remove.mutate(host.id)}
          />
        </div>
      </CardContent>
    </Card>
  );
}
