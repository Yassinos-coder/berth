import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkline } from '@/components/shared/Sparkline';
import { TrafficRules } from '@/features/services/trafficRules';
import type { EdgeTraffic } from '@/interfaces';

export function TrafficCard({ traffic }: { traffic: EdgeTraffic }) {
  const health = TrafficRules.health(traffic.errorRatePct, traffic.requests);
  const errorClass =
    health === 'critical' ? 'text-destructive' : health === 'warning' ? 'text-warning' : '';

  return (
    <Card className="mt-4" data-testid="traffic-card">
      <CardHeader>
        <CardTitle className="text-base">Traffic</CardTitle>
      </CardHeader>
      <CardContent>
        {!traffic.hasTraffic ? (
          <p className="text-muted-foreground text-sm">
            No requests yet. Visits to this service&apos;s domains show up here within a minute.
          </p>
        ) : (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Requests" value={TrafficRules.count(traffic.requests)} />
              <Stat
                label="Server errors (5xx)"
                value={`${traffic.errorRatePct}%`}
                detail={`${TrafficRules.count(traffic.errors5xx)} requests`}
                className={errorClass}
              />
              <Stat label="Client errors (4xx)" value={TrafficRules.count(traffic.errors4xx)} />
              <Stat label="Latency (p95)" value={TrafficRules.latency(traffic.p95Ms)} />
            </dl>
            <Sparkline
              data={traffic.series.map((point) => point.requests)}
              width={480}
              height={48}
              className="w-full"
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({
  label,
  value,
  detail,
  className,
}: {
  label: string;
  value: string;
  detail?: string;
  className?: string;
}) {
  return (
    <div>
      <dt className="text-muted-foreground text-xs">{label}</dt>
      <dd className={`font-mono text-lg ${className ?? ''}`}>{value}</dd>
      {detail ? <dd className="text-muted-foreground text-xs">{detail}</dd> : null}
    </div>
  );
}
