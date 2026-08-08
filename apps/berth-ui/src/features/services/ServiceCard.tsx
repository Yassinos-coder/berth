import { Link } from 'react-router-dom';
import { Cpu, Globe, MemoryStick, Server } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { ServiceStateBadge } from '@/components/shared/StatusBadge';
import { KIND_META, sourceSummary } from '@/features/services/serviceMeta';
import { Format } from '@/lib/format';
import type { Service } from '@/interfaces';

export function ServiceCard({
  service,
  domains,
}: {
  service: Service;
  domains?: string[];
}) {
  const { icon: Icon, label } = KIND_META[service.kind];
  const shownDomains =
    domains && domains.length > 0
      ? domains
      : service.domain
        ? [service.domain]
        : [];

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

        {shownDomains.length > 0 ? (
          <div className="flex flex-col gap-0.5">
            {shownDomains.slice(0, 2).map((domain) => (
              <span
                key={domain}
                className="text-primary inline-flex items-center gap-1 truncate text-xs"
              >
                <Globe className="size-3 shrink-0" />
                {domain}
              </span>
            ))}
            {shownDomains.length > 2 ? (
              <span className="text-muted-foreground text-xs">
                +{shownDomains.length - 2} more
              </span>
            ) : null}
          </div>
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
