import { ExternalLink, Loader2, Lock, Trash2, Unlock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
            className="text-primary inline-flex items-center gap-1.5 font-medium"
          >
            {host.domain}
            <ExternalLink className="size-3.5" />
          </a>
          <p className="text-muted-foreground truncate text-xs">
            → {host.serviceName}:{host.targetPort}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={host.ssl ? 'default' : 'secondary'} className="gap-1">
            {host.ssl ? (
              <Lock className="size-3" />
            ) : (
              <Unlock className="size-3" />
            )}
            {host.ssl ? 'HTTPS' : 'HTTP'}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="text-muted-foreground hover:text-destructive"
            disabled={remove.isPending}
            onClick={() => remove.mutate(host.id)}
          >
            {remove.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Trash2 className="size-4" />
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
