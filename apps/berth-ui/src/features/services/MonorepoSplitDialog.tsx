import { useState } from 'react';
import { Loader2, Split } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateService } from '@/hooks/useServicesMutations';
import { notify } from '@/lib/toast';
import type { DetectedApp } from '@/features/services/repoTree';
import type { ResourceLimits, Server } from '@/interfaces';

export function MonorepoSplitDialog({
  open,
  onOpenChange,
  repo,
  branch,
  apps,
  servers,
  serverId,
  onServerIdChange,
  resources,
  diskGb,
  onUseSingle,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  repo: string;
  branch: string;
  apps: DetectedApp[];
  servers: Server[];
  serverId: string;
  onServerIdChange: (id: string) => void;
  resources: ResourceLimits;
  diskGb: number;
  onUseSingle: () => void;
  onCreated: () => void;
}) {
  const [names, setNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(apps.map((app) => [app.dockerfilePath, app.name])),
  );
  const [creating, setCreating] = useState(false);
  const createService = useCreateService();

  const createSeparately = async () => {
    if (!serverId) return notify.warn('Pick a target server first');
    const trimmed = apps.map((app) => names[app.dockerfilePath]?.trim() ?? '');
    if (trimmed.some((name) => !name)) return notify.warn('Give every service a name');
    if (new Set(trimmed).size !== trimmed.length) {
      return notify.warn('Service names must be unique');
    }

    setCreating(true);
    try {
      for (let i = 0; i < apps.length; i += 1) {
        await createService.mutateAsync({
          name: trimmed[i],
          kind: 'git',
          serverId,
          resources,
          diskGb,
          source: {
            kind: 'git',
            repo,
            branch,
            build: { builder: 'dockerfile', dockerfilePath: apps[i].dockerfilePath },
          },
        });
      }
      onCreated();
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>This looks like a monorepo</DialogTitle>
          <DialogDescription>
            Found {apps.length} Dockerfiles in {repo}. Deploy each as its own
            service so they scale, redeploy, and report status independently
            — or keep it as a single service.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label>Target server</Label>
          <Select value={serverId} onValueChange={onServerIdChange}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a server" />
            </SelectTrigger>
            <SelectContent>
              {servers
                .filter((s) => s.status !== 'enrolling')
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name} · {s.region}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-3">
          {apps.map((app) => (
            <div key={app.dockerfilePath} className="space-y-1.5">
              <Label className="text-xs">{app.dockerfilePath}</Label>
              <Input
                value={names[app.dockerfilePath] ?? ''}
                onChange={(e) =>
                  setNames((prev) => ({ ...prev, [app.dockerfilePath]: e.target.value }))
                }
                placeholder="service-name"
              />
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onUseSingle} disabled={creating}>
            Deploy as one service
          </Button>
          <Button onClick={createSeparately} disabled={creating}>
            {creating ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Split className="size-4" aria-hidden="true" />
            )}
            Deploy {apps.length} separate services
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
