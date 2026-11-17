import { cn } from '@/lib/utils';
import { Format } from '@/lib/format';
import type { CapacityReport } from '@/features/services/new/serverCapacity';

function Bar({ label, used, after, total, text }: { label: string; used: number; after: number; total: number; text: string }) {
  const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0;
  const afterPct = total > 0 ? Math.min(100, (after / total) * 100) : 0;
  const over = after > total;
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className={cn('font-mono', over && 'text-destructive')}>{text}</span>
      </div>
      <div className="bg-muted relative h-2 overflow-hidden rounded-full" role="img" aria-label={`${label}: ${text}`}>
        <div className={cn('absolute inset-y-0 left-0 rounded-full', over ? 'bg-destructive/60' : 'bg-primary/40')} style={{ width: `${afterPct}%` }} />
        <div className="bg-primary absolute inset-y-0 left-0 rounded-full" style={{ width: `${usedPct}%` }} />
      </div>
    </div>
  );
}

export function CapacityPanel({ report, serverName }: { report: CapacityReport | null; serverName: string }) {
  if (!report) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-3 text-xs">
        Pick a server to see how much room it has left.
      </p>
    );
  }
  const { cpu, memory, storage } = report;
  return (
    <div className="space-y-3 rounded-lg border p-3" data-testid="capacity-panel">
      <p className="text-sm font-medium">Room on {serverName}</p>
      <Bar
        label="CPU"
        used={cpu.used}
        after={cpu.after}
        total={cpu.total}
        text={`${round(cpu.after)} of ${cpu.total} vCPU`}
      />
      <Bar
        label="Memory"
        used={memory.used}
        after={memory.after}
        total={memory.total}
        text={`${Format.bytes(memory.after)} of ${Format.bytes(memory.total)}`}
      />
      {storage.allocatableGb !== null ? (
        <Bar
          label="Storage"
          used={storage.allocatedGb}
          after={storage.afterGb}
          total={storage.allocatableGb}
          text={`${storage.afterGb} of ${storage.allocatableGb} GB`}
        />
      ) : (
        <p className="text-muted-foreground text-xs">
          This server has no Berth storage budget, so disk use is not limited. Set one on the server page.
        </p>
      )}
      {report.problems.length > 0 ? (
        <ul role="alert" className="text-destructive space-y-1 text-xs">
          {report.problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
