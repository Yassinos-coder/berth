import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';
import { cn } from '@/lib/utils';
import type { DeployStrategy } from '@berth/protocol';
import type { Service } from '@/interfaces';

interface StrategyOption {
  value: DeployStrategy;
  title: string;
  description: string;
}

const OPTIONS: StrategyOption[] = [
  {
    value: 'rolling',
    title: 'Zero downtime',
    description:
      'Starts the new version beside the old one, switches over once it is healthy, then removes the old one. Best for web apps and APIs. For a moment both versions run at the same time.',
  },
  {
    value: 'recreate',
    title: 'Run once',
    description:
      'Stops the old version first, then starts the new one. There is a brief gap, but two copies never run together. Use it for bots, schedulers and anything that trades, sends or charges.',
  },
];

const GRACE_OPTIONS = [
  { seconds: 0, label: 'Stop right away' },
  { seconds: 30, label: '30 seconds' },
  { seconds: 300, label: '5 minutes' },
  { seconds: 1800, label: '30 minutes' },
  { seconds: 3600, label: '1 hour' },
  { seconds: 7200, label: '2 hours' },
];

export class DeployStrategyRules {
  static blockedReason(service: Pick<Service, 'replicas' | 'replicaPolicy'>): string | null {
    if (service.replicas > 1) {
      return 'Set replicas to 1 before choosing Run once.';
    }
    const policy = service.replicaPolicy?.strategy;
    if (policy && policy !== 'manual') {
      return 'Turn off autoscaling before choosing Run once.';
    }
    return null;
  }
}

export function DeployStrategySettings({ service }: { service: Service }) {
  const update = useUpdateServiceSettings(service.id);
  const current: DeployStrategy = service.deployStrategy ?? 'rolling';
  const blocked = DeployStrategyRules.blockedReason(service);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Deploys</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div role="radiogroup" aria-label="Deploy strategy" className="grid gap-3 sm:grid-cols-2">
          {OPTIONS.map((option) => {
            const selected = option.value === current;
            const disabled =
              update.isPending || (option.value === 'recreate' && !selected && Boolean(blocked));
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={disabled}
                onClick={() => {
                  if (!selected) update.mutate({ deployStrategy: option.value });
                }}
                className={cn(
                  'focus-visible:ring-ring/40 rounded-lg border p-3 text-left transition-colors outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-60',
                  selected ? 'border-primary bg-primary/5' : 'hover:border-primary/40',
                )}
              >
                <span className="flex items-center gap-2 text-sm font-medium">
                  {option.title}
                  {selected && update.isPending ? (
                    <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                  ) : null}
                </span>
                <span className="text-muted-foreground mt-1 block text-xs">
                  {option.description}
                </span>
              </button>
            );
          })}
        </div>
        {blocked && current === 'rolling' ? (
          <p className="text-muted-foreground text-xs">{blocked}</p>
        ) : null}
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Let the old version finish its work</p>
            <p className="text-muted-foreground text-xs">
              After a new version goes live, or when you stop the service, the old
              one stops taking new work but keeps running until it is done, up to
              this long. For anything that holds long tasks, like phone calls or
              queue jobs.
            </p>
          </div>
          <Select
            value={String(service.stopGracePeriodSeconds ?? 0)}
            disabled={update.isPending}
            onValueChange={(value) => update.mutate({ stopGracePeriodSeconds: Number(value) })}
          >
            <SelectTrigger className="w-40 shrink-0" aria-label="Let the old version finish its work">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[
                ...GRACE_OPTIONS,
                ...(GRACE_OPTIONS.some((option) => option.seconds === (service.stopGracePeriodSeconds ?? 0))
                  ? []
                  : [{ seconds: service.stopGracePeriodSeconds ?? 0, label: `${service.stopGracePeriodSeconds} seconds` }]),
              ].map((option) => (
                <SelectItem key={option.seconds} value={String(option.seconds)}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
          <div>
            <p className="text-sm font-medium">Roll back automatically</p>
            <p className="text-muted-foreground text-xs">
              If a new version crashes within 15 minutes of going live, Berth
              restores the previous working version and tells you. Applies to
              services built from GitHub.
            </p>
          </div>
          <Switch
            checked={service.autoRollback ?? true}
            disabled={update.isPending}
            onCheckedChange={(autoRollback) => update.mutate({ autoRollback })}
            aria-label="Roll back automatically"
          />
        </div>
      </CardContent>
    </Card>
  );
}
