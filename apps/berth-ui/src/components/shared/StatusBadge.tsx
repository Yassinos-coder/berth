import { Badge } from '@/components/ui/badge';
import { StatusDot, type Tone } from '@/components/shared/StatusDot';
import type {
  AgentStatus,
  DeploymentStatus,
  ServiceState,
} from '@/interfaces';

type BadgeVariant = 'default' | 'secondary' | 'success' | 'warning' | 'destructive' | 'outline';

interface Descriptor {
  label: string;
  variant: BadgeVariant;
  tone: Tone;
  pulse?: boolean;
}

const SERVICE_STATE: Record<ServiceState, Descriptor> = {
  running: { label: 'Running', variant: 'success', tone: 'success' },
  building: { label: 'Building', variant: 'warning', tone: 'warning', pulse: true },
  starting: { label: 'Starting', variant: 'warning', tone: 'warning', pulse: true },
  unhealthy: { label: 'Unhealthy', variant: 'warning', tone: 'warning' },
  stopped: { label: 'Stopped', variant: 'secondary', tone: 'muted' },
  crashed: { label: 'Crashed', variant: 'destructive', tone: 'destructive' },
};

const AGENT_STATUS: Record<AgentStatus, Descriptor> = {
  online: { label: 'Online', variant: 'success', tone: 'success' },
  offline: { label: 'Offline', variant: 'secondary', tone: 'muted' },
  enrolling: { label: 'Enrolling', variant: 'warning', tone: 'warning', pulse: true },
  degraded: { label: 'Degraded', variant: 'warning', tone: 'warning' },
};

const DEPLOYMENT_STATUS: Record<DeploymentStatus, Descriptor> = {
  queued: { label: 'Queued', variant: 'secondary', tone: 'muted' },
  building: { label: 'Building', variant: 'warning', tone: 'warning', pulse: true },
  deploying: { label: 'Deploying', variant: 'warning', tone: 'warning', pulse: true },
  live: { label: 'Live', variant: 'success', tone: 'success' },
  failed: { label: 'Failed', variant: 'destructive', tone: 'destructive' },
  canceled: { label: 'Canceled', variant: 'secondary', tone: 'muted' },
};

function render({ label, variant, tone, pulse }: Descriptor) {
  return (
    <Badge variant={variant} className="gap-1.5 py-1">
      <StatusDot tone={tone} pulse={pulse} />
      {label}
    </Badge>
  );
}

export function ServiceStateBadge({ state }: { state: ServiceState }) {
  return render(SERVICE_STATE[state]);
}

export function AgentStatusBadge({ status }: { status: AgentStatus }) {
  return render(AGENT_STATUS[status]);
}

export function DeploymentStatusBadge({ status }: { status: DeploymentStatus }) {
  return render(DEPLOYMENT_STATUS[status]);
}
