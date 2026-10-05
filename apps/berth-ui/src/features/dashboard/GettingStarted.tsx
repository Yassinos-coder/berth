import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Check, Circle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { useDashboardStats } from '@/hooks/useDashboardQueries';
import { useGithubStatus } from '@/hooks/useGithubQueries';
import { useNotificationChannels } from '@/hooks/useNotificationChannels';
import { useProxyHosts } from '@/hooks/useProxyHostsQueries';
import { useServices } from '@/hooks/useServicesQueries';
import { GettingStartedSteps } from '@/features/dashboard/utils/gettingStartedSteps';

const DISMISS_KEY = 'berth.gettingStarted.dismissed';

function readDismissed(): boolean {
  try {
    return window.localStorage.getItem(DISMISS_KEY) === '1';
  } catch {
    return false;
  }
}

function writeDismissed() {
  try {
    window.localStorage.setItem(DISMISS_KEY, '1');
  } catch {
    return;
  }
}

export function GettingStarted() {
  const [dismissed, setDismissed] = useState(readDismissed);
  const stats = useDashboardStats();
  const github = useGithubStatus();
  const services = useServices();
  const proxyHosts = useProxyHosts();
  const channels = useNotificationChannels();

  if (dismissed) return null;
  const ready = [stats, github, services, proxyHosts, channels].every((query) => query.isSuccess);
  if (!ready) return null;

  const steps = GettingStartedSteps.compute({
    serversOnline: stats.data?.serversOnline ?? 0,
    githubConnected: Boolean(github.data?.connected),
    serviceCount: services.data?.length ?? 0,
    proxyHostCount: proxyHosts.data?.length ?? 0,
    channelCount: channels.data?.length ?? 0,
  });
  const remaining = GettingStartedSteps.remaining(steps);
  if (remaining.length === 0) return null;

  const completed = steps.length - remaining.length;

  return (
    <Card aria-labelledby="getting-started-title">
      <CardHeader className="flex-row items-start justify-between gap-4">
        <div className="space-y-1">
          <CardTitle id="getting-started-title" className="text-base">
            Get started with Berth
          </CardTitle>
          <p className="text-muted-foreground text-sm">
            {completed} of {steps.length} done
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Dismiss getting started"
          onClick={() => {
            writeDismissed();
            setDismissed(true);
          }}
        >
          <X className="size-4" aria-hidden="true" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <Progress value={(completed / steps.length) * 100} aria-label="Setup progress" />
        <ul className="divide-border divide-y">
          {steps.map((step) => (
            <li key={step.id}>
              <Link
                to={step.to}
                className="hover:bg-muted/40 -mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 transition-colors"
              >
                {step.done ? (
                  <Check className="text-success mt-0.5 size-4 shrink-0" aria-label="Done" />
                ) : (
                  <Circle className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-label="To do" />
                )}
                <div className="min-w-0">
                  <p className={cn('text-sm font-medium', step.done && 'text-muted-foreground line-through')}>
                    {step.title}
                  </p>
                  <p className="text-muted-foreground text-xs">{step.description}</p>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}
