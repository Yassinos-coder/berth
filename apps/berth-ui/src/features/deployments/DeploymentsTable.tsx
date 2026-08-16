import { Github, GitCommitHorizontal, RotateCcw } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DeploymentStatusBadge } from '@/components/shared/StatusBadge';
import { Format } from '@/lib/format';
import type { Deployment } from '@/interfaces';

interface DeploymentsTableProps {
  deployments: Deployment[];
  showService?: boolean;
  onRollback?: (id: string) => void;
  rollbackPendingId?: string;
}

const TRIGGER_LABEL: Record<string, string> = {
  push: 'GitHub push',
  manual: 'Manual',
  redeploy: 'Redeploy',
  rollback: 'Rollback',
};

export function DeploymentsTable({
  deployments,
  showService = false,
  onRollback,
  rollbackPendingId,
}: DeploymentsTableProps) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Commit</TableHead>
          {showService ? <TableHead>Service</TableHead> : null}
          <TableHead>Status</TableHead>
          <TableHead>Trigger</TableHead>
          <TableHead>Duration</TableHead>
          <TableHead>When</TableHead>
          {onRollback ? <TableHead className="text-right">Actions</TableHead> : null}
        </TableRow>
      </TableHeader>
      <TableBody>
        {deployments.map((dep) => (
          <TableRow key={dep.id}>
            <TableCell>
              <div className="flex items-center gap-2">
                <GitCommitHorizontal className="text-muted-foreground size-4" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="max-w-[240px] truncate text-sm font-medium">
                    {dep.commitMessage ?? 'Manual deploy'}
                  </p>
                  <p className="text-muted-foreground font-mono text-xs">
                    {dep.commitSha ? Format.commit(dep.commitSha) : 'â€”'}
                    {dep.branch ? ` Â· ${dep.branch}` : ''}
                  </p>
                </div>
              </div>
            </TableCell>
            {showService ? (
              <TableCell className="text-sm">{dep.serviceName}</TableCell>
            ) : null}
            <TableCell>
              <DeploymentStatusBadge status={dep.status} />
            </TableCell>
            <TableCell>
              <Badge variant="outline" className="gap-1">
                {dep.trigger === 'push' ? <Github className="size-3" aria-hidden="true" /> : null}
                {TRIGGER_LABEL[dep.trigger] ?? dep.trigger}
              </Badge>
            </TableCell>
            <TableCell className="text-muted-foreground text-sm tabular-nums">
              {dep.durationSeconds ? Format.duration(dep.durationSeconds) : 'â€”'}
            </TableCell>
            <TableCell className="text-muted-foreground text-sm">
              {Format.relativeTime(dep.createdAt)}
            </TableCell>
            {onRollback ? (
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={dep.status !== 'live' || rollbackPendingId === dep.id}
                  onClick={() => onRollback(dep.id)}
                >
                  <RotateCcw className="size-3.5" aria-hidden="true" />
                  Rollback
                </Button>
              </TableCell>
            ) : null}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
