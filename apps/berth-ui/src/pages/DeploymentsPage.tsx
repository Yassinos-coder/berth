import { Rocket } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { DeploymentsTable } from '@/features/deployments/DeploymentsTable';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useDeployments, useRollback } from '@/hooks/useDeploymentsQueries';

export function DeploymentsPage() {
  const { data, isLoading, isError, error, refetch } = useDeployments();
  const rollback = useRollback();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Deployments"
        description="Every build and reconcile across your fleet."
      />

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        loadingFallback={<Skeleton className="h-96" />}
      >
        {(data ?? []).length === 0 ? (
          <EmptyState
            icon={Rocket}
            title="No deployments yet"
            description="Deploys appear here on every push or manual trigger."
          />
        ) : (
          <Card className="py-0">
            <CardContent className="p-0">
              <DeploymentsTable
                deployments={data ?? []}
                showService
                onRollback={(id) => rollback.mutate(id)}
                rollbackPendingId={
                  rollback.isPending
                    ? (rollback.variables as string)
                    : undefined
                }
              />
            </CardContent>
          </Card>
        )}
      </QueryBoundary>
    </div>
  );
}
