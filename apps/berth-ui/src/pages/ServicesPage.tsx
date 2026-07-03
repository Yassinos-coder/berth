import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Boxes, Plus } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { ServiceCard } from '@/features/services/ServiceCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useServices } from '@/hooks/useServicesQueries';
import type { ServiceKind } from '@/interfaces';

export function ServicesPage() {
  const { data, isLoading, isError, error, refetch } = useServices();
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<ServiceKind | 'all'>('all');

  const filtered = useMemo(() => {
    return (data ?? []).filter((svc) => {
      const matchesQuery = svc.name
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchesKind = kind === 'all' || svc.kind === kind;
      return matchesQuery && matchesKind;
    });
  }, [data, query, kind]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Services"
        description="Every deployable is a ServiceSpec — apps, databases, buckets."
        actions={
          <Button asChild>
            <Link to="/services/new">
              <Plus className="size-4" />
              New service
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-3 sm:flex-row">
        <Input
          placeholder="Search services…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="sm:max-w-xs"
        />
        <Select value={kind} onValueChange={(v) => setKind(v as typeof kind)}>
          <SelectTrigger className="sm:w-44">
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
            title="No services yet"
            description="Deploy your first app, database, or bucket to get started."
            action={
              <Button asChild>
                <Link to="/services/new">
                  <Plus className="size-4" />
                  New service
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((svc) => (
              <ServiceCard key={svc.id} service={svc} />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
