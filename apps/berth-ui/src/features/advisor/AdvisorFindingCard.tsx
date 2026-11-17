import { AlertTriangle, Check, Info, Loader2, Undo2, X } from 'lucide-react';
import type { AdvisorFindingDto } from '@berth/protocol';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const SEVERITY_LABEL = { info: 'Tip', warning: 'Warning', critical: 'Important' } as const;

export function AdvisorFindingCard({
  finding,
  canAct,
  busy,
  onApply,
  onDismiss,
  onUndo,
}: {
  finding: AdvisorFindingDto;
  canAct: boolean;
  busy: boolean;
  onApply: () => void;
  onDismiss: () => void;
  onUndo: () => void;
}) {
  const Icon = finding.severity === 'info' ? Info : AlertTriangle;
  const open = finding.status === 'open';

  return (
    <Card data-testid="advisor-finding">
      <CardContent className="space-y-3 pt-6">
        <div className="flex flex-wrap items-center gap-2">
          <Icon
            className={finding.severity === 'critical' ? 'text-destructive size-4' : 'text-muted-foreground size-4'}
            aria-hidden="true"
          />
          <h3 className="text-sm font-semibold">{finding.title}</h3>
          <Badge variant={finding.severity === 'critical' ? 'destructive' : 'secondary'}>
            {SEVERITY_LABEL[finding.severity]}
          </Badge>
          {finding.source === 'ai' ? <Badge variant="outline">AI</Badge> : null}
          {finding.serviceName ? (
            <span className="text-muted-foreground text-xs" translate="no">
              {finding.serviceName}
            </span>
          ) : null}
          {!open ? (
            <Badge variant="outline">{finding.status === 'applied' ? 'Applied' : 'Dismissed'}</Badge>
          ) : null}
        </div>

        <p className="text-muted-foreground text-sm">{finding.detail}</p>

        {finding.evidence.length > 0 ? (
          <ul className="text-muted-foreground list-disc space-y-0.5 pl-5 text-xs">
            {finding.evidence.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        ) : null}

        {open && finding.actionLabel ? (
          <p className="bg-muted/50 rounded-md px-3 py-2 text-sm">{finding.actionLabel}</p>
        ) : null}

        {canAct && open ? (
          <div className="flex flex-wrap gap-2">
            {finding.action ? (
              <Button size="sm" onClick={onApply} disabled={busy}>
                {busy ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Check className="size-4" aria-hidden="true" />}
                Apply
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={onDismiss} disabled={busy}>
              <X className="size-4" aria-hidden="true" />
              Decline
            </Button>
          </div>
        ) : null}

        {canAct && finding.canUndo ? (
          <Button size="sm" variant="outline" onClick={onUndo} disabled={busy}>
            <Undo2 className="size-4" aria-hidden="true" />
            Undo
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
