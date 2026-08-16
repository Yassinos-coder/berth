import { useState } from 'react';
import { Loader2, RotateCcw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBackupTargets } from '@/hooks/useBackupTargets';
import { useBackups, useCreateBackup, useRestoreBackup } from '@/hooks/useBackups';
import { Format } from '@/lib/format';
import type { BackupStatus } from '@/interfaces';

function StatusBadge({ status }: { status: BackupStatus }) {
  if (status === 'success') return <Badge variant="success">Success</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="secondary">Running</Badge>;
}

function formatBytes(bytes?: number): string {
  if (!bytes) return 'â€”';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BackupsPanel({ serviceId }: { serviceId: string }) {
  const targets = useBackupTargets();
  const backups = useBackups(serviceId);
  const create = useCreateBackup(serviceId);
  const restore = useRestoreBackup(serviceId);
  const [targetId, setTargetId] = useState<string>('');

  const selectedTarget = targetId || targets.data?.[0]?.id || '';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Backups</CardTitle>
        <div className="flex items-center gap-2">
          <Select
            value={selectedTarget}
            onValueChange={setTargetId}
            disabled={!targets.data || targets.data.length === 0}
          >
            <SelectTrigger className="w-56">
              <SelectValue placeholder="Choose a backup target" />
            </SelectTrigger>
            <SelectContent>
              {targets.data?.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            disabled={!selectedTarget || create.isPending}
            onClick={() => create.mutate(selectedTarget)}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Back up now
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!targets.data || targets.data.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No backup targets configured yet. Add one in Settings â†’ Backups.
          </p>
        ) : null}
        {backups.data && backups.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Target</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Started</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {backups.data.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <StatusBadge status={b.status} />
                    {b.status === 'failed' && b.errorMessage ? (
                      <p className="text-destructive mt-1 max-w-xs truncate text-xs">
                        {b.errorMessage}
                      </p>
                    ) : null}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {b.backupTargetName}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {formatBytes(b.sizeBytes)}
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {Format.relativeTime(b.startedAt)}
                  </TableCell>
                  <TableCell>
                    {b.status === 'success' ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={restore.isPending}
                        onClick={() => restore.mutate(b.id)}
                      >
                        <RotateCcw className="size-4" aria-hidden="true" /> Restore
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">No backups yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
