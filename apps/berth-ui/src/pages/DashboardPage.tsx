import { Link } from 'react-router-dom';
import {
  Activity,
  Boxes,
  Cpu,
  MemoryStick,
  Rocket,
  Server,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatTile } from '@/components/shared/StatTile';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { ActivityFeed } from '@/features/dashboard/ActivityFeed';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { ServiceStateBadge } from '@/components/shared/StatusBadge';
import { useDashboardStats, useActivity } from '@/hooks/useDashboardQueries';
import { useServices } from '@/hooks/useServicesQueries';

export function DashboardPage() {
  const stats = useDashboardStats();
  const activity = useActivity();
  const services = useServices();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Overview"
        description="Health of your fleet at a glance."
        actions={
          <Button asChild>
            <Link to="/services/new">
              <Rocket className="size-4" />
              Deploy
            </Link>
          </Button>
        }
      />

      <QueryBoundary
        isLoading={stats.isLoading}
        isError={stats.isError}
        error={stats.error}
        onRetry={() => stats.refetch()}
        loadingFallback={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28" />
            ))}
          </div>
        }
      >
        {stats.data ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Servers"
              value={stats.data.servers}
              hint={`${stats.data.serversOnline} online`}
              icon={Server}
            />
            <StatTile
              label="Services"
              value={stats.data.services}
              hint={`${stats.data.servicesRunning} running`}
              icon={Boxes}
              accent="success"
            />
            <StatTile
              label="Avg CPU"
              value={`${stats.data.avgCpuPct}%`}
              icon={Cpu}
              accent={stats.data.avgCpuPct >= 80 ? 'destructive' : 'primary'}
            />
            <StatTile
              label="Avg Memory"
              value={`${stats.data.avgMemPct}%`}
              icon={MemoryStick}
              accent={stats.data.avgMemPct >= 80 ? 'warning' : 'primary'}
            />
          </div>
        ) : null}
      </QueryBoundary>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="gap-0 py-0 lg:col-span-2">
          <CardHeader className="flex-row items-center justify-between border-b py-4">
            <CardTitle className="text-base">Services</CardTitle>
            <Button asChild variant="ghost" size="sm">
              <Link to="/services">
                View all <ArrowRight className="size-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <QueryBoundary
              isLoading={services.isLoading}
              isError={services.isError}
              error={services.error}
              onRetry={() => services.refetch()}
              loadingFallback={
                <div className="space-y-3 p-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              }
            >
              <ul className="divide-border divide-y">
                {(services.data ?? []).slice(0, 6).map((svc) => (
                  <li key={svc.id}>
                    <Link
                      to={`/services/${svc.id}`}
                      className="hover:bg-muted/40 flex items-center gap-3 px-6 py-3 transition-colors"
                    >
                      <Activity className="text-muted-foreground size-4" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {svc.name}
                        </p>
                        <p className="text-muted-foreground truncate text-xs">
                          {svc.serverName}
                        </p>
                      </div>
                      <ServiceStateBadge state={svc.state} />
                    </Link>
                  </li>
                ))}
              </ul>
            </QueryBoundary>
          </CardContent>
        </Card>

        <QueryBoundary
          isLoading={activity.isLoading}
          isError={activity.isError}
          error={activity.error}
          onRetry={() => activity.refetch()}
          loadingFallback={<Skeleton className="h-80" />}
        >
          <ActivityFeed items={activity.data ?? []} />
        </QueryBoundary>
      </div>
    </div>
  );
}
