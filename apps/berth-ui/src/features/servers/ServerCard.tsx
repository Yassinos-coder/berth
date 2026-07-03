import { Link } from 'react-router-dom';
import { Boxes, Cpu, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { AgentStatusBadge } from '@/components/shared/StatusBadge';
import { UsageBar } from '@/components/shared/UsageBar';
import { Format } from '@/lib/format';
import type { Server } from '@/interfaces';

export function ServerCard({ server }: { server: Server }) {
  const memPct = server.usage.memTotalMb
    ? (server.usage.memMb / server.usage.memTotalMb) * 100
    : 0;
  const enrolling = server.status === 'enrolling';

  return (
    <Link to={`/servers/${server.id}`} className="group block">
      <Card className="hover:border-primary/40 transition-colors">
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="group-hover:text-primary truncate font-medium transition-colors">
                {server.name}
              </p>
              <p className="text-muted-foreground flex items-center gap-1 truncate text-xs">
                <Globe className="size-3" />
                {server.region}
              </p>
            </div>
            <AgentStatusBadge status={server.status} />
          </div>

          {enrolling ? (
            <p className="text-muted-foreground text-sm">
              Waiting for the agent to dial back…
            </p>
          ) : (
            <>
              <UsageBar label="CPU" value={server.usage.cpuPct} />
              <UsageBar label="Memory" value={memPct} />
              <div className="border-border/60 text-muted-foreground flex items-center gap-4 border-t pt-3 text-xs">
                <span className="inline-flex items-center gap-1">
                  <Cpu className="size-3.5" />
                  {server.cpuCores} vCPU
                </span>
                <span className="inline-flex items-center gap-1">
                  <Boxes className="size-3.5" />
                  {server.serviceCount} services
                </span>
                <span className="ml-auto">
                  {Format.relativeTime(server.lastSeen)}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
