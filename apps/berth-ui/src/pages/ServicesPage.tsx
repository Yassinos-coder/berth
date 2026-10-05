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
import { useEnvironments } from '@/hooks/useEnvironments';
import { Badge } from '@/components/ui/badge';
import { ServiceGroups } from '@/features/environments/utils/serviceGroups';
import type { ServiceKind } from '@/interfaces';
import { ComposeImportDialog } from '@/features/services/ComposeImportDialog';

export function ServicesPage() {
  const { data, isLoading, isError, error, refetch } = useServices();
  const proxyHosts = useProxyHosts();
  const environments = useEnvironments();
  const [searchParams, setSearchParams] = useSearchParams();
  const query = searchParams.get('q') ?? '';
  const kind = (searchParams.get('kind') as ServiceKind | 'all') ?? 'all';
  const environmentFilter = searchParams.get('env') ?? 'all';
  const groupParam = searchParams.get('group');

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
      if (environmentFilter === 'none' && svc.environmentId) return false;
      if (environmentFilter !== 'all' && environmentFilter !== 'none' && svc.environmentId !== environmentFilter) {
        return false;
      }
      if (needle && !svc.name.toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [data, query, kind, environmentFilter]);

  const environmentList = environments.data ?? [];
  const canGroup = ServiceGroups.hasAssignments(data ?? [], environmentList);
  const grouped = canGroup && groupParam !== 'none';
  const groups = useMemo(
    () => (grouped ? ServiceGroups.group(filtered, environmentList) : []),
    [grouped, filtered, environmentList],
  );
  const filtering = Boolean(query) || kind !== 'all' || environmentFilter !== 'all';

  const renderCards = (items: typeof filtered) => (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
      {items.map((svc) => (
        <ServiceCard key={svc.id} service={svc} domains={domainsByService.get(svc.id)} />
      ))}
    </div>
  );

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
        {environmentList.length > 0 ? (
          <>
            <Label htmlFor="service-environment" className="sr-only">
              Filter by environment
            </Label>
            <Select value={environmentFilter} onValueChange={(v) => setParam('env', v)}>
              <SelectTrigger id="service-environment" className="sm:w-48">
                <SelectValue placeholder="All environments" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All environments</SelectItem>
                {environmentList.map((environment) => (
                  <SelectItem key={environment.id} value={environment.id}>
                    {environment.name}
                  </SelectItem>
                ))}
                <SelectItem value="none">No environment</SelectItem>
              </SelectContent>
            </Select>
          </>
        ) : null}
        {canGroup ? (
          <Button
            variant="outline"
            aria-pressed={grouped}
            onClick={() => setParam('group', grouped ? 'none' : 'environment')}
          >
            {grouped ? 'Ungroup' : 'Group by environment'}
          </Button>
        ) : null}
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
            title={filtering ? 'No matching services' : 'No services yet'}
            description={
              filtering
                ? 'Clear the search box and filters to see everything.'
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
        ) : grouped ? (
          <div className="space-y-8">
            {groups.map((group) => (
              <section key={group.id ?? 'none'} aria-labelledby={`env-${group.id ?? 'none'}`} className="space-y-3">
                <div className="flex items-center gap-2">
                  <h2 id={`env-${group.id ?? 'none'}`} className="text-sm font-semibold">
                    {group.name}
                  </h2>
                  {group.isProduction ? <Badge>Production</Badge> : null}
                  {group.preview ? <Badge variant="secondary">Preview</Badge> : null}
                  <span className="text-muted-foreground text-xs">{group.services.length}</span>
                </div>
                {renderCards(group.services)}
              </section>
            ))}
          </div>
        ) : (
          renderCards(filtered)
        )}
      </QueryBoundary>
    </div>
  );
}
