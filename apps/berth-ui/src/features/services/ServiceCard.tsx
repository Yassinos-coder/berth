import { Link } from 'react-router-dom';
import { Cpu, ExternalLink, MemoryStick, Server } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ServiceStateBadge } from '@/components/shared/StatusBadge';
import { KIND_META, sourceSummary } from '@/features/services/serviceMeta';
import { Format } from '@/lib/format';
import type { Service } from '@/interfaces';

export function ServiceCard({ service }: { service: Service }) {
  const { icon: Icon, label } = KIND_META[service.kind];

  return (
    <Link to={`/services/${service.id}`} className="group block">
      <Card className="hover:border-primary/40 gap-4 p-5 transition-colors">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
              <Icon className="size-4.5" />
            </span>
            <div className="min-w-0">
              <p className="group-hover:text-primary truncate font-medium transition-colors">
                {service.name}
              </p>
              <p className="text-muted-foreground truncate text-xs">{label}</p>
            </div>
          </div>
          <ServiceStateBadge state={service.state} />
        </div>

        <p className="text-muted-foreground truncate font-mono text-xs">
          {sourceSummary(service.source)}
        </p>

        {service.domain ? (
          <span className="text-primary inline-flex items-center gap-1 truncate text-xs">
            <ExternalLink className="size-3" />
            {service.domain}
          </span>
        ) : null}

        <div className="border-border/60 text-muted-foreground flex items-center gap-4 border-t pt-3 text-xs">
          <span className="inline-flex items-center gap-1">
            <Server className="size-3.5" />
            {service.serverName}
          </span>
          <span className="inline-flex items-center gap-1">
            <Cpu className="size-3.5" />
            {Format.percent(service.usage.cpuPct)}
          </span>
          <span className="inline-flex items-center gap-1">
            <MemoryStick className="size-3.5" />
            {Format.bytes(service.usage.memMb)}
          </span>
        </div>
      </Card>
    </Link>
  );
}
