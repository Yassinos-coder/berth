import { ExternalLink, Loader2, Lock, Network, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/shared/CopyButton';
import { AddProxyHostDialog } from '@/features/proxy-hosts/AddProxyHostDialog';
import { useProxyHosts } from '@/hooks/useProxyHostsQueries';
import { useRemoveProxyHost } from '@/hooks/useProxyHostsMutations';
import {
  useAddInternalDomain,
  useRemoveInternalDomain,
} from '@/hooks/useServicesMutations';
import type { Service } from '@/interfaces';

export function ServiceDomains({ service }: { service: Service }) {
  const proxyHosts = useProxyHosts();
  const removeHost = useRemoveProxyHost();
  const addInternal = useAddInternalDomain(service.id);
  const removeInternal = useRemoveInternalDomain(service.id);
  const port = service.containerPort ?? 80;
  const publicHosts = (proxyHosts.data ?? []).filter(
    (host) => host.serviceId === service.id,
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Public domains</p>
              <p className="text-muted-foreground text-sm">
                Served over the internet with automatic HTTPS via the proxy.
              </p>
            </div>
            <AddProxyHostDialog defaultServiceId={service.id} />
          </div>

          {publicHosts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No public domains yet.</p>
          ) : (
            publicHosts.map((host) => (
              <div
                key={host.id}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <a
                  href={`${host.ssl ? 'https' : 'http'}://${host.domain}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary inline-flex items-center gap-1.5 text-sm font-medium"
                >
                  {host.domain}
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                </a>
                <div className="flex items-center gap-2">
                  {host.ssl ? (
                    <span className="text-muted-foreground inline-flex items-center gap-1 text-xs">
                      <Lock className="size-3" aria-hidden="true" /> HTTPS
                    </span>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => removeHost.mutate(host.id)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Internal domains</p>
              <p className="text-muted-foreground text-sm">
                Private hostnames on the <span className="font-mono">berth</span>{' '}
                network — reach this service from another container at{' '}
                <span className="font-mono">http://&lt;domain&gt;:{port}</span>,
                no public exposure.
              </p>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={addInternal.isPending}
              onClick={() => addInternal.mutate()}
            >
              {addInternal.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Generate
            </Button>
          </div>

          {service.internalDomains.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No internal domains yet.
            </p>
          ) : (
            service.internalDomains.map((domain) => (
              <div
                key={domain}
                className="flex items-center justify-between rounded-lg border p-3"
              >
                <span className="inline-flex items-center gap-1.5 font-mono text-sm">
                  <Network className="text-muted-foreground size-3.5" aria-hidden="true" />
                  {domain}
                </span>
                <div className="flex items-center gap-1">
                  <CopyButton value={`http://${domain}:${port}`} />
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive"
                    disabled={removeInternal.isPending}
                    onClick={() => removeInternal.mutate(domain)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
