import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Plus, TerminalSquare } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/shared/CopyButton';
import { useEnrollServer } from '@/hooks/useServersMutations';
import { queryKeys } from '@/lib/queryClient';
import { Format } from '@/lib/format';
import type { Enrollment } from '@/interfaces';

export function AddServerDialog() {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const enroll = useEnrollServer();
  const qc = useQueryClient();

  const reset = () => {
    setName('');
    setEnrollment(null);
  };

  const generate = () => {
    if (!name.trim()) return;
    enroll.mutate(name.trim(), { onSuccess: (data) => setEnrollment(data) });
  };

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) {
      reset();
      qc.invalidateQueries({ queryKey: queryKeys.servers });
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add server
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a server</DialogTitle>
          <DialogDescription>
            Run the one-time install command on your VPS. The agent dials back,
            presents the bootstrap token, and receives a long-lived client cert.
          </DialogDescription>
        </DialogHeader>

        {!enrollment ? (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="server-name">Server name</Label>
              <Input
                id="server-name"
                placeholder="gra-prod-02"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && generate()}
              />
            </div>
            <DialogFooter>
              <Button onClick={generate} disabled={enroll.isPending || !name.trim()}>
                {enroll.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <TerminalSquare className="size-4" />
                )}
                Generate install command
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">
                Run on your server (as root)
              </Label>
              <div className="bg-muted flex items-start gap-2 rounded-lg border p-3">
                <code className="flex-1 font-mono text-xs break-all">
                  {enrollment.installCommand}
                </code>
                <CopyButton value={enrollment.installCommand} />
              </div>
            </div>
            <div className="border-warning/40 bg-warning/10 text-warning rounded-lg border px-3 py-2 text-xs">
              This bootstrap token is single-use and expires{' '}
              {Format.relativeTime(enrollment.expiresAt)}. It is burned after
              the agent enrolls.
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => close(false)}>
                Done
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
