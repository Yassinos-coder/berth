import { useState } from 'react';
import { Eye, EyeOff, Globe, Lock, Network } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CopyButton } from '@/components/shared/CopyButton';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import { useServiceConnection } from '@/hooks/useServicesQueries';
import type { Connection } from '@/interfaces';

function UrlRow({
  icon: Icon,
  label,
  url,
  hint,
}: {
  icon: typeof Globe;
  label: string;
  url?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-sm font-medium">
        <Icon className="text-muted-foreground size-4" />
        {label}
      </div>
      {url ? (
        <div className="bg-muted flex items-center gap-2 rounded-lg border p-2 pl-3">
          <code className="flex-1 overflow-x-auto whitespace-nowrap font-mono text-xs">
            {url}
          </code>
          <CopyButton value={url} />
        </div>
      ) : (
        <p className="text-muted-foreground text-xs">{hint}</p>
      )}
    </div>
  );
}

function Field({
  label,
  value,
  secret = false,
}: {
  label: string;
  value?: string;
  secret?: boolean;
}) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return null;
  const shown = secret && !revealed ? '•'.repeat(Math.min(value.length, 16)) : value;
  return (
    <div className="flex-1 space-y-1">
      {label ? <p className="text-muted-foreground text-xs">{label}</p> : null}
      <div className="flex items-center gap-1.5">
        <code className="bg-muted flex-1 truncate rounded-md px-2 py-1.5 font-mono text-xs">
          {shown}
        </code>
        {secret ? (
          <button
            type="button"
            onClick={() => setRevealed((r) => !r)}
            className="text-muted-foreground hover:text-foreground rounded-md p-1.5"
            aria-label={revealed ? 'Hide' : 'Reveal'}
          >
            {revealed ? (
              <EyeOff className="size-3.5" />
            ) : (
              <Eye className="size-3.5" />
            )}
          </button>
        ) : null}
        <CopyButton value={value} />
      </div>
    </div>
  );
}

function ConnectionView({ connection }: { connection: Connection }) {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Connection URLs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <UrlRow
            icon={Network}
            label="Private URL"
            url={connection.privateUrl}
            hint="Reachable from other services on this server."
          />
          <UrlRow
            icon={Globe}
            label="Public URL"
            url={connection.publicUrl}
            hint={
              connection.publicNetworking
                ? 'The server has no public IP recorded yet.'
                : 'Public networking is off — enable it to expose this database.'
            }
          />
          {connection.publicUrl ? (
            <div className="border-warning/40 bg-warning/10 text-warning rounded-lg border px-3 py-2 text-xs">
              This database is reachable from the public internet. Make sure your
              firewall and credentials are strong.
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base">Credentials</CardTitle>
          {connection.publicNetworking ? (
            <Badge variant="warning" className="gap-1">
              <Globe className="size-3" /> public
            </Badge>
          ) : (
            <Badge variant="secondary" className="gap-1">
              <Lock className="size-3" /> private
            </Badge>
          )}
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-3">
          <Field label="Host" value={connection.host} />
          <Field label="Port" value={connection.port?.toString()} />
          <Field label="Username" value={connection.username} />
          <Field label="Password" value={connection.password} secret />
          {connection.database ? (
            <Field label="Database" value={connection.database} />
          ) : null}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-base">Variables</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ul className="divide-border divide-y">
            {connection.variables.map((variable) => (
              <li
                key={variable.key}
                className="flex items-center gap-3 px-5 py-2.5"
              >
                <code className="text-primary w-64 shrink-0 truncate font-mono text-xs">
                  {variable.key}
                </code>
                <Field label="" value={variable.value} secret={variable.isSecret} />
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

export function ConnectionPanel({ serviceId }: { serviceId: string }) {
  const connection = useServiceConnection(serviceId);

  return (
    <QueryBoundary
      isLoading={connection.isLoading}
      isError={connection.isError}
      error={connection.error}
      onRetry={() => connection.refetch()}
      loadingFallback={<Skeleton className="h-64" />}
    >
      {connection.data ? <ConnectionView connection={connection.data} /> : null}
    </QueryBoundary>
  );
}
