import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { LayoutTemplate, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTemplates } from '@/hooks/useTemplatesQueries';
import type { Template } from '@/interfaces';

function TemplateIcon({ name }: { name: string }) {
  const Icon = (Icons[name as keyof typeof Icons] ??
    Icons.Package) as LucideIcon;
  return <Icon className="size-5" aria-hidden="true" />;
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <Link to={`/services/new?template=${template.id}`} className="group block">
      <Card className="hover:border-primary/40 h-full transition-colors">
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span
              className="flex size-10 items-center justify-center rounded-lg text-white"
              style={{ backgroundColor: template.accent }}
            >
              <TemplateIcon name={template.icon} />
            </span>
            {template.official ? (
              <Badge variant="secondary" className="text-xs">
                Official
              </Badge>
            ) : (
              <Badge variant="outline" className="text-xs">
                Community
              </Badge>
            )}
          </div>
          <div>
            <p className="group-hover:text-primary font-medium transition-colors">
              {template.name}
            </p>
            <p className="text-muted-foreground mt-1 text-sm leading-snug">
              {template.description}
            </p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

const CATEGORIES: { value: Template['category'] | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'app', label: 'Apps' },
  { value: 'tooling', label: 'Tooling' },
  { value: 'database', label: 'Databases' },
  { value: 'cache', label: 'Cache' },
  { value: 'storage', label: 'Storage' },
];

export function TemplatesPage() {
  const { data, isLoading, isError, error, refetch } = useTemplates();
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<Template['category'] | 'all'>('all');

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return (data ?? []).filter((tpl) => {
      if (category !== 'all' && tpl.category !== category) return false;
      if (!needle) return true;
      return (
        tpl.name.toLowerCase().includes(needle) ||
        tpl.description.toLowerCase().includes(needle)
      );
    });
  }, [data, query, category]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Pre-filled ServiceSpecs — deploy popular software in one click."
      />

      <div className="flex flex-wrap items-center gap-2">
        <Input
          type="search"
          name="template-search"
          autoComplete="off"
          aria-label="Search templates"
          placeholder="Search templates…"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-8 w-64"
        />
        <div className="flex flex-wrap gap-1" role="group" aria-label="Filter by category">
          {CATEGORIES.map((item) => (
            <Button
              key={item.value}
              size="sm"
              variant={category === item.value ? 'secondary' : 'outline'}
              aria-pressed={category === item.value}
              onClick={() => setCategory(item.value)}
            >
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      <QueryBoundary
        isLoading={isLoading}
        isError={isError}
        error={error}
        onRetry={() => refetch()}
        loadingFallback={
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-40" />
            ))}
          </div>
        }
      >
        {visible.length === 0 ? (
          <EmptyState
            icon={LayoutTemplate}
            title="No templates found"
            description="Try a different search or category."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visible.map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
