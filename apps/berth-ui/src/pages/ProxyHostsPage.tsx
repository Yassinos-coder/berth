import { Globe } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { Skeleton } from '@/components/ui/skeleton';
import { AddProxyHostDialog } from '@/features/proxy-hosts/AddProxyHostDialog';
import { ProxyHostCard } from '@/features/proxy-hosts/ProxyHostCard';
import { useProxyHosts } from '@/hooks/useProxyHostsQueries';

export function ProxyHostsPage() {
  const hosts = useProxyHosts();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proxy Hosts"
        description="Route domains to your services with automatic HTTPS."
        actions={<AddProxyHostDialog />}
      />

      <QueryBoundary
        isLoading={hosts.isLoading}
        isError={hosts.isError}
        error={hosts.error}
        onRetry={() => hosts.refetch()}
        loadingFallback={<Skeleton className="h-40" />}
      >
        {(hosts.data ?? []).length === 0 ? (
          <EmptyState
            icon={Globe}
            title="No proxy hosts yet"
            description="Add a domain and point it at a running service — Berth handles TLS and HTTP/2 automatically."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {(hosts.data ?? []).map((host) => (
              <ProxyHostCard key={host.id} host={host} />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
