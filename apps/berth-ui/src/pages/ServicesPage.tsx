import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Boxes, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { ServiceCard } from '@/features/services/ServiceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useServices } from '@/hooks/useServicesQueries';
import { useProxyHosts } from '@/hooks/useProxyHostsQueries';
import type { ServiceKind } from '@/interfaces';
import { ComposeImportDialog } from '@/features/services/ComposeImportDialog';

export function ServicesPage() {
  const { data, isLoading, isError, error, refetch } = useServices();
  const proxyHosts = useProxyHosts();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const kind = (searchParams.get('kind') as ServiceKind | 'all') ?? 'all';

  const setParam = (name: string, value: string) =>
    setSearchParams(
      (current) => {
        const next = new URLSearchParams(current);
        if (!value || value === 'all') next.delete(name);
        else next.set(name, value);
        return next;
      },
      { replace: true },
    );

  const domainsByService = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const host of proxyHosts.data ?? []) {
      const list = map.get(host.serviceId) ?? [];
      list.push(host.domain);
      map.set(host.serviceId, list);
    }
    return map;
  }, [proxyHosts.data]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data ?? []).filter((svc) => {
      if (kind !== 'all' && svc.kind !== kind) return false;
      if (needle && !svc.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, query, kind]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Every deployable is a ServiceSpec — apps, databases, buckets."
        actions={
          <div className="flex flex-wrap gap-2"><ComposeImportDialog /><Button asChild>
            <Link to="/services/new">
              <Plus className="size-4" aria-hidden="true" />
              New Service
            </Link>
          </Button></div>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Label htmlFor="service-search" className="sr-only">
          Search services by name
        </Label>
        <Input
          id="service-search"
          name="q"
          type="search"
          autoComplete="off"
          spellCheck={false}
          placeholder="Search services…"
          value={query}
          onChange={(e) => setParam('q', e.target.value)}
          className="sm:max-w-xs"
        />
        <Label htmlFor="service-kind" className="sr-only">
          Filter by service kind
        </Label>
        <Select value={kind} onValueChange={(v) => setParam('kind', v)}>
          <SelectTrigger id="service-kind" className="sm:w-44">
            <SelectValue placeholder="All kinds" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All kinds</SelectItem>
            <SelectItem value="git">Git repository</SelectItem>
            <SelectItem value="image">Docker image</SelectItem>
            <SelectItem value="database">Database</SelectItem>
            <SelectItem value="bucket">Bucket</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        loadingFallback={
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-44" />
            ))}
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            icon={Boxes}
            title={query || kind !== 'all' ? 'No matching services' : 'No services yet'}
            description={
              query || kind !== 'all'
                ? 'Clear the search box or choose “All kinds” to see everything.'
                : 'Deploy your first app, database, or bucket to get started.'
            }
            action={
              <Button asChild>
                <Link to="/services/new">
                  <Plus className="size-4" aria-hidden="true" />
                  New Service
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((svc) => (
              <ServiceCard
                key={svc.id}
                service={svc}
                domains={domainsByService.get(svc.id)}
              />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
