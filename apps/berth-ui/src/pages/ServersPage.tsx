import { Server } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { ServerCard } from '@/features/servers/ServerCard';
import { AddServerDialog } from '@/features/servers/AddServerDialog';
import { Skeleton } from '@/components/ui/skeleton';
import { useServers } from '@/hooks/useServersQueries';

export function ServersPage() {
  const { data, isLoading, isError, error, refetch } = useServers();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Servers"
        description="Each server runs a native berth-agent that dials back over mTLS."
        actions={<AddServerDialog />}
      />

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        loadingFallback={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-52" />
            ))}
          </div>
        }
      >
        {(data ?? []).length === 0 ? (
          <EmptyState
            icon={Server}
            title="No servers connected"
            description="Add your first VPS — install the agent and it enrolls automatically."
            action={<AddServerDialog />}
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {(data ?? []).map((server) => (
              <ServerCard key={server.id} server={server} />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
