import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Sparkline } from '@/components/shared/Sparkline';
import { Format } from '@/lib/format';
import type { MetricPoint } from '@/interfaces';

export function MetricsPanel({ points }: { points: MetricPoint[] }) {
  const cpu = points.map((p) => p.cpuPct);
  const mem = points.map((p) => p.memMb);
  const lastCpu = cpu.at(-1) ?? 0;
  const lastMem = mem.at(-1) ?? 0;
  const peakCpu = cpu.length ? Math.max(...cpu) : 0;
  const peakMem = mem.length ? Math.max(...mem) : 0;

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm font-medium">
            CPU usage
          </CardTitle>
          <p className="text-2xl font-semibold tabular-nums">
            {Format.percent(lastCpu)}
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-primary">
            <Sparkline data={cpu} width={480} height={80} className="w-full" />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Peak {Format.percent(peakCpu)} over last hour
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-muted-foreground text-sm font-medium">
            Memory usage
          </CardTitle>
          <p className="text-2xl font-semibold tabular-nums">
            {Format.bytes(lastMem)}
          </p>
        </CardHeader>
        <CardContent>
          <div className="text-success">
            <Sparkline
              data={mem}
              width={480}
              height={80}
              className="w-full"
              strokeClassName="stroke-success"
              fillClassName="fill-success/10"
            />
          </div>
          <p className="text-muted-foreground mt-2 text-xs">
            Peak {Format.bytes(peakMem)} over last hour
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
