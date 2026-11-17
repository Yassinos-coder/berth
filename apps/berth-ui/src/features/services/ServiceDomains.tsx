import { useState } from 'react';
import { Loader2, Network, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CopyButton } from '@/components/shared/CopyButton';
import { AddProxyHostDialog } from '@/features/proxy-hosts/AddProxyHostDialog';
import { ProxyHostCard } from '@/features/proxy-hosts/ProxyHostCard';
import { useProxyHosts } from '@/hooks/useProxyHostsQueries';
import {
  useAddInternalDomain,
  useRemoveInternalDomain,
} from '@/hooks/useServicesMutations';
import type { Service } from '@/interfaces';

export function ServiceDomains({ service }: { service: Service }) {
  const proxyHosts = useProxyHosts();
  const addInternal = useAddInternalDomain(service.id);
  const removeInternal = useRemoveInternalDomain(service.id);
  const [customDomain, setCustomDomain] = useState('');
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
            <p className="text-muted-foreground text-sm">
              No public domains yet. Add one to reach this service from the
              internet over HTTPS.
            </p>
          ) : (
            <div className="space-y-2">
              {publicHosts.map((host) => (
                <ProxyHostCard key={host.id} host={host} showService={false} />
              ))}
            </div>
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
              onClick={() => addInternal.mutate(undefined)}
            >
              {addInternal.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Plus className="size-4" aria-hidden="true" />
              )}
              Generate
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Input
              placeholder="exact name, e.g. api — for code that expects a specific hostname"
              value={customDomain}
              onChange={(e) => setCustomDomain(e.target.value)}
              className="font-mono text-sm"
            />
            <Button
              size="sm"
              variant="outline"
              disabled={addInternal.isPending || !customDomain.trim()}
              onClick={() => {
                addInternal.mutate(customDomain.trim(), {
                  onSuccess: () => setCustomDomain(''),
                });
              }}
            >
              Add
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
