import { useState } from 'react';
import { KeyRound, Loader2, RefreshCw } from 'lucide-react';
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
import { Label } from '@/components/ui/label';
import { CopyButton } from '@/components/shared/CopyButton';
import { useReenrollServer } from '@/hooks/useServersMutations';
import { Format } from '@/lib/format';
import type { Enrollment } from '@/interfaces';

export function ReenrollDialog({
  serverId,
  isLocal,
}: {
  serverId: string;
  isLocal: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [enrollment, setEnrollment] = useState<Enrollment | null>(null);
  const reenroll = useReenrollServer();

  const generate = () =>
    reenroll.mutate(serverId, { onSuccess: (data) => setEnrollment(data) });

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) setEnrollment(null);
  };

  const localCommands = enrollment
    ? [
        `sudo sed -i "s|^BERTH_BOOTSTRAP=.*|BERTH_BOOTSTRAP=${enrollment.token}|" /etc/berth/agent.env`,
        'sudo rm -f /etc/berth/agent.crt /etc/berth/agent.key',
        'sudo systemctl restart berth-agent',
      ].join('\n')
    : '';
  const command = isLocal ? localCommands : (enrollment?.installCommand ?? '');

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <RefreshCw className="size-4" aria-hidden="true" /> Regenerate token
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Regenerate bootstrap token</DialogTitle>
          <DialogDescription>
            Issues a fresh single-use token so the agent can re-enroll â€” for
            example after the panel was reinstalled with a new certificate
            authority.
          </DialogDescription>
        </DialogHeader>

        {!enrollment ? (
          <DialogFooter>
            <Button onClick={generate} disabled={reenroll.isPending}>
              {reenroll.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <KeyRound className="size-4" aria-hidden="true" />
              )}
              Generate token
            </Button>
          </DialogFooter>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-muted-foreground text-xs">
                {isLocal
                  ? 'Run on this server (as root)'
                  : 'Run on your server (as root)'}
              </Label>
              <div className="bg-muted flex items-start gap-2 rounded-lg border p-3">
                <code className="flex-1 font-mono text-xs break-all whitespace-pre-wrap">
                  {command}
                </code>
                <CopyButton value={command} />
              </div>
            </div>
            <div className="border-warning/40 bg-warning/10 text-warning rounded-lg border px-3 py-2 text-xs">
              Single-use token â€” expires {Format.relativeTime(enrollment.expiresAt)}.
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
