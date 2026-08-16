import { useState } from 'react';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  useBackupTargets,
  useCreateBackupTarget,
  useRemoveBackupTarget,
} from '@/hooks/useBackupTargets';

function AddBackupTargetDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [endpoint, setEndpoint] = useState('');
  const [bucket, setBucket] = useState('');
  const [accessKeyId, setAccessKeyId] = useState('');
  const [secretAccessKey, setSecretAccessKey] = useState('');
  const create = useCreateBackupTarget();

  const reset = () => {
    setName('');
    setEndpoint('');
    setBucket('');
    setAccessKeyId('');
    setSecretAccessKey('');
  };

  const submit = () => {
    if (!name.trim() || !endpoint.trim() || !bucket.trim() || !accessKeyId || !secretAccessKey) {
      return;
    }
    create.mutate(
      {
        name: name.trim(),
        endpoint: endpoint.trim(),
        bucket: bucket.trim(),
        accessKeyId,
        secretAccessKey,
      },
      { onSuccess: () => { setOpen(false); reset(); } },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" /> Add target
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Add backup target</DialogTitle>
          <DialogDescription>
            Any S3-compatible destination â€” AWS S3, Backblaze B2, Wasabi, or a
            self-hosted MinIO bucket.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="target-name">Name</Label>
            <Input id="target-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Off-site backups" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target-endpoint">Endpoint</Label>
            <Input
              id="target-endpoint"
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="s3.us-east-1.amazonaws.com"
              className="font-mono"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target-bucket">Bucket</Label>
            <Input id="target-bucket" value={bucket} onChange={(e) => setBucket(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target-access-key">Access key ID</Label>
            <Input id="target-access-key" value={accessKeyId} onChange={(e) => setAccessKeyId(e.target.value)} className="font-mono" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target-secret-key">Secret access key</Label>
            <Input
              id="target-secret-key"
              type="password"
              value={secretAccessKey}
              onChange={(e) => setSecretAccessKey(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && submit()}
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            onClick={submit}
            disabled={
              create.isPending ||
              !name.trim() ||
              !endpoint.trim() ||
              !bucket.trim() ||
              !accessKeyId ||
              !secretAccessKey
            }
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Add
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function BackupTargetsSettings() {
  const targets = useBackupTargets();
  const remove = useRemoveBackupTarget();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Backup targets</CardTitle>
        <AddBackupTargetDialog />
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          S3-compatible destinations for database backups. Attach one when
          backing up a Postgres, MySQL, MariaDB, or Mongo service.
        </p>
        {targets.data && targets.data.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Endpoint</TableHead>
                <TableHead>Bucket</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {targets.data.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {t.endpoint}
                  </TableCell>
                  <TableCell className="text-muted-foreground font-mono text-xs">
                    {t.bucket}
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={remove.isPending}
                      onClick={() => remove.mutate(t.id)}
                    >
                      <Trash2 className="text-destructive size-4" aria-hidden="true" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="text-muted-foreground text-sm">
            No backup targets yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
