import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Cpu,
  HardDrive,
  Loader2,
  MemoryStick,
  Trash2,
} from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { AgentStatusBadge } from '@/components/shared/StatusBadge';
import { StatTile } from '@/components/shared/StatTile';
import { ServiceStateBadge } from '@/components/shared/StatusBadge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useServer } from '@/hooks/useServersQueries';
import { useRemoveServer } from '@/hooks/useServersMutations';
import { useServices } from '@/hooks/useServicesQueries';
import { Format } from '@/lib/format';
import { Boxes } from 'lucide-react';

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="truncate text-sm font-medium">{value}</span>
    </div>
  );
}

export function ServerDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const server = useServer(id);
  const services = useServices();
  const removeServer = useRemoveServer();

  const srv = server.data;
  const hosted = (services.data ?? []).filter((s) => s.serverId === id);
  const memPct = srv?.usage.memTotalMb
    ? (srv.usage.memMb / srv.usage.memTotalMb) * 100
    : 0;
  const diskPct = srv?.usage.diskTotalGb
    ? (srv.usage.diskGb / srv.usage.diskTotalGb) * 100
    : 0;

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm" className="-ml-2">
        <Link to="/servers">
          <ArrowLeft className="size-4" /> Servers
        </Link>
      </Button>

      <QueryBoundary
        isLoading={server.isLoading}
        isError={server.isError}
        error={server.error}
        onRetry={() => server.refetch()}
        loadingFallback={<Skeleton className="h-24" />}
      >
        {srv ? (
          <>
            <PageHeader
              title={srv.name}
              description={`${srv.region} · ${srv.ip}`}
              actions={
                <div className="flex items-center gap-2">
                  <AgentStatusBadge status={srv.status} />
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm">
                        <Trash2 className="size-4" /> Remove
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Remove {srv.name}?</DialogTitle>
                        <DialogDescription>
                          Revokes the agent’s client certificate. Running
                          containers keep running until you reconnect or clean
                          up manually.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="outline">Cancel</Button>
                        </DialogClose>
                        <Button
                          variant="destructive"
                          disabled={removeServer.isPending}
                          onClick={() =>
                            removeServer.mutate(srv.id, {
                              onSuccess: () => navigate('/servers'),
                            })
                          }
                        >
                          {removeServer.isPending ? (
                            <Loader2 className="size-4 animate-spin" />
                          ) : null}
                          Remove server
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              }
            />

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <StatTile
                label="CPU"
                value={`${Math.round(srv.usage.cpuPct)}%`}
                hint={`${srv.cpuCores} vCPU`}
                icon={Cpu}
                accent={srv.usage.cpuPct >= 85 ? 'destructive' : 'primary'}
              />
              <StatTile
                label="Memory"
                value={`${Math.round(memPct)}%`}
                hint={`${Format.bytes(srv.usage.memMb)} / ${Format.bytes(srv.memoryMb)}`}
                icon={MemoryStick}
                accent={memPct >= 85 ? 'warning' : 'primary'}
              />
              <StatTile
                label="Disk"
                value={`${Math.round(diskPct)}%`}
                hint={`${srv.usage.diskGb} / ${srv.diskGb} GB`}
                icon={HardDrive}
                accent={diskPct >= 85 ? 'warning' : 'primary'}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="divide-border divide-y">
                  <DetailRow label="IP address" value={srv.ip} />
                  <DetailRow label="Operating system" value={srv.os} />
                  <DetailRow label="Agent version" value={srv.agentVersion} />
                  <DetailRow label="Last seen" value={Format.relativeTime(srv.lastSeen)} />
                  <DetailRow label="Enrolled" value={Format.dateTime(srv.createdAt)} />
                </CardContent>
              </Card>

              <Card className="py-0">
                <CardContent className="p-0">
                  <div className="border-b px-5 py-4">
                    <p className="font-medium">Services on this server</p>
                  </div>
                  {hosted.length === 0 ? (
                    <div className="p-5">
                      <EmptyState
                        icon={Boxes}
                        title="No services here yet"
                        description="Deploy a service targeting this server."
                      />
                    </div>
                  ) : (
                    <ul className="divide-border divide-y">
                      {hosted.map((svc) => (
                        <li key={svc.id}>
                          <Link
                            to={`/services/${svc.id}`}
                            className="hover:bg-muted/40 flex items-center justify-between gap-3 px-5 py-3 transition-colors"
                          >
                            <span className="truncate text-sm font-medium">
                              {svc.name}
                            </span>
                            <ServiceStateBadge state={svc.state} />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        ) : null}
      </QueryBoundary>
    </div>
  );
}
