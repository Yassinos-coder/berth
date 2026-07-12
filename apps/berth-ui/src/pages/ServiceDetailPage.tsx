import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  ExternalLink,
  Loader2,
  Play,
  RotateCw,
  Rocket,
  Server,
  Square,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { ServiceStateBadge } from '@/components/shared/StatusBadge';
import { DeploymentsTable } from '@/features/deployments/DeploymentsTable';
import { LogViewer } from '@/features/services/LogViewer';
import { MetricsPanel } from '@/features/services/MetricsPanel';
import { EnvironmentEditor } from '@/features/services/EnvironmentEditor';
import { ConnectionPanel } from '@/features/services/ConnectionPanel';
import {
  KIND_META,
  builderLabel,
  sourceSummary,
} from '@/features/services/serviceMeta';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/dialog';
import {
  useService,
  useServiceLogs,
  useServiceMetrics,
} from '@/hooks/useServicesQueries';
import {
  useServiceAction,
  useRemoveService,
} from '@/hooks/useServicesMutations';
import { useServiceDeployments, useRollback } from '@/hooks/useDeploymentsQueries';
import { Format } from '@/lib/format';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

export function ServiceDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const service = useService(id);
  const logs = useServiceLogs(id);
  const metrics = useServiceMetrics(id);
  const deployments = useServiceDeployments(id);
  const action = useServiceAction(id);
  const removeService = useRemoveService();
  const rollback = useRollback();

  const svc = service.data;
  const isRunning = svc?.state === 'running';

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/services">
          <ArrowLeft className="size-4" /> Services
        </Link>
      </Button>

      <QueryBoundary
        isLoading={service.isLoading}
        isError={service.isError}
        error={service.error}
        onRetry={() => service.refetch()}
        loadingFallback={<Skeleton className="h-24" />}
      >
        {svc ? (
          <>
            <PageHeader
              title={svc.name}
              description={sourceSummary(svc.source)}
              actions={
                <div className="flex flex-wrap items-center gap-2">
                  <ServiceStateBadge state={svc.state} />
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate('redeploy')}
                  >
                    <Rocket className="size-4" /> Redeploy
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={action.isPending}
                    onClick={() => action.mutate('restart')}
                  >
                    <RotateCw className="size-4" /> Restart
                  </Button>
                  {isRunning ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={action.isPending}
                      onClick={() => action.mutate('stop')}
                    >
                      <Square className="size-4" /> Stop
                    </Button>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={action.isPending}
                      onClick={() => action.mutate('start')}
                    >
                      <Play className="size-4" /> Start
                    </Button>
                  )}
                </div>
              }
            />

            <Tabs defaultValue="overview">
              <TabsList className="w-full max-w-2xl">
                <TabsTrigger value="overview">Overview</TabsTrigger>
                {svc.templateKind ? (
                  <TabsTrigger value="connect">Connect</TabsTrigger>
                ) : null}
                <TabsTrigger value="deployments">Deployments</TabsTrigger>
                <TabsTrigger value="logs">Logs</TabsTrigger>
                <TabsTrigger value="metrics">Metrics</TabsTrigger>
                <TabsTrigger value="env">Variables</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {svc.templateKind ? (
                <TabsContent value="connect" className="mt-4">
                  <ConnectionPanel serviceId={svc.id} />
                </TabsContent>
              ) : null}

              <TabsContent value="overview" className="mt-4">
                <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                  <Card>
                    <CardContent className="divide-border divide-y">
                      <DetailRow
                        label="Kind"
                        value={KIND_META[svc.kind].label}
                      />
                      <DetailRow label="Source" value={sourceSummary(svc.source)} />
                      {builderLabel(svc.source) ? (
                        <DetailRow
                          label="Builder"
                          value={builderLabel(svc.source)!}
                        />
                      ) : null}
                      <DetailRow label="Server" value={svc.serverName} />
                      <DetailRow label="Replicas" value={String(svc.replicas)} />
                      {svc.domain ? (
                        <DetailRow label="Domain" value={svc.domain} />
                      ) : null}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="divide-border divide-y">
                      <DetailRow
                        label="CPU limit"
                        value={Format.cpu(svc.resources.cpuCores)}
                      />
                      <DetailRow
                        label="Memory limit"
                        value={Format.bytes(svc.resources.memoryMb)}
                      />
                      <DetailRow
                        label="CPU usage"
                        value={Format.percent(svc.usage.cpuPct)}
                      />
                      <DetailRow
                        label="Memory usage"
                        value={Format.bytes(svc.usage.memMb)}
                      />
                      <DetailRow
                        label="Created"
                        value={Format.dateTime(svc.createdAt)}
                      />
                    </CardContent>
                  </Card>
                </div>
                {svc.domain ? (
                  <a
                    href={`https://${svc.domain}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-primary mt-4 inline-flex items-center gap-1.5 text-sm"
                  >
                    <ExternalLink className="size-4" />
                    https://{svc.domain}
                  </a>
                ) : null}
              </TabsContent>

              <TabsContent value="deployments" className="mt-4">
                <Card className="py-0">
                  <CardContent className="p-0">
                    <QueryBoundary
                      isLoading={deployments.isLoading}
                      isError={deployments.isError}
                      error={deployments.error}
                      onRetry={() => deployments.refetch()}
                    >
                      {(deployments.data ?? []).length === 0 ? (
                        <div className="p-6">
                          <EmptyState
                            icon={Rocket}
                            title="No deployments yet"
                            description="Push to the connected branch or trigger a manual deploy."
                          />
                        </div>
                      ) : (
                        <DeploymentsTable
                          deployments={deployments.data ?? []}
                          onRollback={(depId) => rollback.mutate(depId)}
                          rollbackPendingId={
                            rollback.isPending
                              ? (rollback.variables as string)
                              : undefined
                          }
                        />
                      )}
                    </QueryBoundary>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="logs" className="mt-4">
                <QueryBoundary
                  isLoading={logs.isLoading}
                  isError={logs.isError}
                  error={logs.error}
                  onRetry={() => logs.refetch()}
                  loadingFallback={<Skeleton className="h-[460px]" />}
                >
                  <LogViewer lines={logs.data ?? []} />
                </QueryBoundary>
              </TabsContent>

              <TabsContent value="metrics" className="mt-4">
                <QueryBoundary
                  isLoading={metrics.isLoading}
                  isError={metrics.isError}
                  error={metrics.error}
                  onRetry={() => metrics.refetch()}
                  loadingFallback={<Skeleton className="h-56" />}
                >
                  <MetricsPanel points={metrics.data ?? []} />
                </QueryBoundary>
              </TabsContent>

              <TabsContent value="env" className="mt-4">
                <EnvironmentEditor />
              </TabsContent>

              <TabsContent value="settings" className="mt-4">
                <Card className="border-destructive/30">
                  <CardContent className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">Delete this service</p>
                      <p className="text-muted-foreground text-sm">
                        Stops and removes the container. This cannot be undone.
                      </p>
                    </div>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="destructive">
                          <Trash2 className="size-4" /> Delete service
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Delete {svc.name}?</DialogTitle>
                          <DialogDescription>
                            The agent will stop and remove the container on{' '}
                            {svc.serverName}. Volumes are preserved unless
                            detached separately.
                          </DialogDescription>
                        </DialogHeader>
                        <DialogFooter>
                          <DialogClose asChild>
                            <Button variant="outline">Cancel</Button>
                          </DialogClose>
                          <Button
                            variant="destructive"
                            disabled={removeService.isPending}
                            onClick={() =>
                              removeService.mutate(svc.id, {
                                onSuccess: () => navigate('/services'),
                              })
                            }
                          >
                            {removeService.isPending ? (
                              <Loader2 className="size-4 animate-spin" />
                            ) : null}
                            Delete
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </CardContent>
                </Card>
                <Button asChild variant="ghost" className="mt-4">
                  <Link to={`/servers/${svc.serverId}`}>
                    <Server className="size-4" /> View host server
                  </Link>
                </Button>
              </TabsContent>
            </Tabs>
          </>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
