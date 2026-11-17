import { Progress } from '@/components/ui/progress';

export function AdvisorSpendMeter({ spentUsd, capUsd }: { spentUsd: number; capUsd: number }) {
  const pct = capUsd > 0 ? Math.min(100, (spentUsd / capUsd) * 100) : 100;
  return (
    <div className="min-w-48 space-y-1" data-testid="advisor-spend">
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">This month</span>
        <span className="font-mono">
          ${spentUsd.toFixed(2)} / ${capUsd.toFixed(2)}
        </span>
      </div>
      <Progress value={pct} aria-label="Advisor spend this month" />
    </div>
  );
}
