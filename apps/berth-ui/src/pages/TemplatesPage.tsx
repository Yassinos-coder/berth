import { Link } from 'react-router-dom';
import * as Icons from 'lucide-react';
import { LayoutTemplate, type LucideIcon } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTemplates } from '@/hooks/useTemplatesQueries';
import type { Template } from '@/interfaces';

function TemplateIcon({ name }: { name: string }) {
  const Icon = (Icons[name as keyof typeof Icons] ??
    Icons.Package) as LucideIcon;
  return <Icon className="size-5" />;
}

function TemplateCard({ template }: { template: Template }) {
  return (
    <Link to="/services/new" className="group block">
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

export function TemplatesPage() {
  const { data, isLoading, isError, error, refetch } = useTemplates();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Templates"
        description="Pre-filled ServiceSpecs — deploy popular software in one click."
      />

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
        {(data ?? []).length === 0 ? (
          <EmptyState
            icon={LayoutTemplate}
            title="No templates available"
            description="Templates will appear here once the catalog is loaded."
          />
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {(data ?? []).map((tpl) => (
              <TemplateCard key={tpl.id} template={tpl} />
            ))}
          </div>
        )}
      </QueryBoundary>
    </div>
  );
}
