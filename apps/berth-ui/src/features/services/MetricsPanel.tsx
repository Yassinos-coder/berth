import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkline } from "@/components/shared/Sparkline";
import { Format } from "@/lib/format";
import type { MetricPeak, MetricPoint } from "@/interfaces";

export type MetricsRange = "live" | "1h" | "24h" | "7d";

const RANGE_OPTIONS: { value: MetricsRange; label: string }[] = [
  { value: "live", label: "Live" },
  { value: "1h", label: "1h" },
  { value: "24h", label: "24h" },
  { value: "7d", label: "7d" },
];

export function MetricsPanel({
  points,
  peak,
  range,
  onRangeChange,
}: {
  points: MetricPoint[];
  peak?: MetricPeak;
  range: MetricsRange;
  onRangeChange: (range: MetricsRange) => void;
}) {
  const cpu = points.map((p) => p.cpuPct);
  const mem = points.map((p) => p.memMb);
  const net = points.map((p) => (p.netRxMb ?? 0) + (p.netTxMb ?? 0));
  const lastCpu = cpu.at(-1) ?? 0;
  const lastMem = mem.at(-1) ?? 0;
  const lastRx = points.at(-1)?.netRxMb ?? 0;
  const lastTx = points.at(-1)?.netTxMb ?? 0;
  const peakCpu = peak ? peak.cpuPct : cpu.length ? Math.max(...cpu) : 0;
  const peakMem = peak ? peak.memMb : mem.length ? Math.max(...mem) : 0;

  return (
    <div className="space-y-4">
      <div className="flex gap-1" role="group" aria-label="Time range">
        {RANGE_OPTIONS.map((option) => (
          <Button
            key={option.value}
            size="sm"
            variant={range === option.value ? "secondary" : "outline"}
            aria-pressed={range === option.value}
            onClick={() => onRangeChange(option.value)}
          >
            {option.label}
          </Button>
        ))}
      </div>
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
              <Sparkline
                data={cpu}
                width={480}
                height={80}
                className="w-full"
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Peak {Format.percent(peakCpu)} over last 24 hours
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
              Peak {Format.bytes(peakMem)} over last 24 hours
            </p>
          </CardContent>
        </Card>

        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="text-muted-foreground text-sm font-medium">
              Network I/O
            </CardTitle>
            <p className="text-2xl font-semibold tabular-nums">
              ↓ {Format.bytes(lastRx)} · ↑ {Format.bytes(lastTx)}
            </p>
          </CardHeader>
          <CardContent>
            <div className="text-warning">
              <Sparkline
                data={net}
                width={480}
                height={80}
                className="w-full"
                strokeClassName="stroke-warning"
                fillClassName="fill-warning/10"
              />
            </div>
            <p className="text-muted-foreground mt-2 text-xs">
              Cumulative received / transmitted
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
