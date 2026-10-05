import { CircleCheck, CircleHelp, Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useDnsCheck } from '@/hooks/useProxyHostsQueries';
import type { DnsCheckStatus } from '@/services/proxyHostsService';

const TONE: Record<DnsCheckStatus, string> = {
  ok: 'border-success/40 bg-success/10 text-success',
  mismatch: 'border-warning/40 bg-warning/10 text-warning',
  unresolved: 'border-warning/40 bg-warning/10 text-warning',
  unknown: 'border-border bg-muted/40 text-muted-foreground',
};

const ICON: Record<DnsCheckStatus, typeof CircleCheck> = {
  ok: CircleCheck,
  mismatch: TriangleAlert,
  unresolved: TriangleAlert,
  unknown: CircleHelp,
};

export function DnsCheckNotice({ domain, serviceId }: { domain: string; serviceId: string }) {
  const debounced = useDebouncedValue(domain, 600);
  const check = useDnsCheck(debounced, serviceId);

  if (!domain.trim()) {
    return (
      <p className="text-muted-foreground text-xs">
        Point your domain's DNS A record at this server and open ports 80 &amp; 443 before the
        certificate can be issued.
      </p>
    );
  }

  if (!serviceId) {
    return <p className="text-muted-foreground text-xs">Pick a service to check the domain's DNS.</p>;
  }

  if (check.isFetching || debounced !== domain) {
    return (
      <p className="text-muted-foreground flex items-center gap-2 text-xs" aria-live="polite">
        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" /> Checking DNS…
      </p>
    );
  }

  if (check.isError || !check.data) {
    return (
      <p className="text-muted-foreground text-xs">
        Could not check DNS right now. Make sure the A record points at this server.
      </p>
    );
  }

  const { status, message } = check.data;
  const Icon = ICON[status];

  return (
    <div
      role="status"
      aria-live="polite"
      data-dns-status={status}
      className={cn('flex items-start gap-2 rounded-lg border px-3 py-2 text-xs', TONE[status])}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p className="flex-1">{message}</p>
      <Button variant="ghost" size="sm" className="h-6 px-2 text-xs" onClick={() => check.refetch()}>
        Re-check
      </Button>
    </div>
  );
}
