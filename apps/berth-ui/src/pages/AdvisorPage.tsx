import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { PageHeader } from '@/components/shared/PageHeader';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { EmptyState } from '@/components/shared/EmptyState';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdvisorFindingCard } from '@/features/advisor/AdvisorFindingCard';
import { AdvisorSpendMeter } from '@/features/advisor/AdvisorSpendMeter';
import {
  useAdvisorFindingActions,
  useAdvisorFindings,
  useAdvisorSummary,
  useRunAdvisor,
} from '@/hooks/useAdvisor';
import { useAuth } from '@/hooks/useAuth';

export function AdvisorPage() {
  const { user } = useAuth();
  const [view, setView] = useState<'open' | 'history'>('open');
  const summary = useAdvisorSummary();
  const findings = useAdvisorFindings(view);
  const run = useRunAdvisor();
  const actions = useAdvisorFindingActions();
  const canAct = user?.role !== 'viewer';
  const enabled = summary.data?.enabled ?? false;
  const busyId = actions.apply.isPending
    ? actions.apply.variables
    : actions.dismiss.isPending
      ? actions.dismiss.variables
      : actions.undo.isPending
        ? actions.undo.variables
        : undefined;

  return (
    <div className="space-y-6">
      <PageHeader
        title="AI advisor"
        description="Suggestions based on how your services and servers are really behaving."
        actions={
          <div className="flex flex-wrap items-center gap-4">
            {summary.data ? (
              <AdvisorSpendMeter spentUsd={summary.data.spentUsd} capUsd={summary.data.capUsd} />
            ) : null}
            {canAct && enabled ? (
              <Button onClick={() => run.mutate()} disabled={run.isPending}>
                {run.isPending ? (
                  <Loader2 className="size-4 animate-spin" aria-hidden="true" />
                ) : (
                  <Sparkles className="size-4" aria-hidden="true" />
                )}
                Analyze now
              </Button>
            ) : null}
          </div>
        }
      />

      {summary.data && !enabled ? (
        <EmptyState
          icon={Sparkles}
          title="The advisor is turned off"
          description="Turn it on in Settings to get suggestions such as right-sizing memory or growing a nearly full disk."
          action={
            <Button asChild>
              <Link to="/settings">Open settings</Link>
            </Button>
          }
        />
      ) : (
        <>
          <Tabs value={view} onValueChange={(value) => setView(value as 'open' | 'history')}>
            <TabsList>
              <TabsTrigger value="open">
                Suggestions{summary.data?.openCount ? ` (${summary.data.openCount})` : ''}
              </TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>
          </Tabs>

          <QueryBoundary
            isLoading={findings.isLoading}
            isError={findings.isError}
            error={findings.error}
            onRetry={() => findings.refetch()}
            loadingFallback={<Skeleton className="h-40" />}
          >
            {(findings.data ?? []).length === 0 ? (
              <EmptyState
                icon={Sparkles}
                title={view === 'open' ? 'Nothing to suggest' : 'No history yet'}
                description={
                  view === 'open'
                    ? 'Everything looks healthy. The advisor checks again every day.'
                    : 'Suggestions you apply or decline show up here.'
                }
              />
            ) : (
              <div className="space-y-3">
                {(findings.data ?? []).map((finding) => (
                  <AdvisorFindingCard
                    key={finding.id}
                    finding={finding}
                    canAct={canAct}
                    busy={busyId === finding.id}
                    onApply={() => actions.apply.mutate(finding.id)}
                    onDismiss={() => actions.dismiss.mutate(finding.id)}
                    onUndo={() => actions.undo.mutate(finding.id)}
                  />
                ))}
              </div>
            )}
          </QueryBoundary>
        </>
      )}
    </div>
  );
}
