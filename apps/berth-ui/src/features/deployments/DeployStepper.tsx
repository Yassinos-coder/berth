import { Check, Loader2, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { Deployment, LogLine } from '@/interfaces';
import { DeployStages, type StageState } from '@/features/deployments/utils/deployStages';

const STATE_STYLE: Record<StageState, string> = {
  pending: 'border-border text-muted-foreground',
  active: 'border-primary text-primary',
  done: 'border-success bg-success/10 text-success',
  failed: 'border-destructive bg-destructive/10 text-destructive',
};

function StageIcon({ state }: { state: StageState }) {
  if (state === 'done') return <Check className="size-3.5" aria-hidden="true" />;
  if (state === 'failed') return <X className="size-3.5" aria-hidden="true" />;
  if (state === 'active') return <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />;
  return null;
}

export function DeployStepper({
  deployment,
  logs,
  sourceKind,
  serviceId,
}: {
  deployment: Deployment;
  logs: LogLine[];
  sourceKind: 'git' | 'image';
  serviceId: string;
}) {
  const lines = logs.filter((entry) => entry.stream === 'build').map((entry) => entry.line);
  const stages = DeployStages.compute({ sourceKind, status: deployment.status, lines });
  const inFlight = DeployStages.isInFlight(deployment.status);

  return (
    <div className="space-y-3 p-4" aria-label="Deployment progress">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-medium">
          {inFlight ? 'Deploying now' : deployment.status === 'live' ? 'Latest deployment' : 'Latest deployment failed'}
        </p>
        <Link
          to={`/services/${serviceId}?tab=logs&logs=build`}
          className="text-primary text-xs hover:underline"
        >
          View build logs
        </Link>
      </div>
      <ol className="flex flex-wrap items-center gap-x-2 gap-y-2">
        {stages.map((stage, index) => (
          <li key={stage.id} data-stage={stage.id} data-state={stage.state} className="flex items-center gap-2">
            <span
              className={cn(
                'flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium',
                STATE_STYLE[stage.state],
              )}
            >
              <StageIcon state={stage.state} />
              {stage.label}
            </span>
            {index < stages.length - 1 ? (
              <span className="bg-border h-px w-4" aria-hidden="true" />
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}
