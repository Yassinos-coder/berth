import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

export function UsageBar({
  label,
  value,
  detail,
}: {
  label: string;
  value: number;
  detail?: string;
}) {
  const tone =
    value >= 85
      ? 'bg-destructive'
      : value >= 65
        ? 'bg-warning'
        : 'bg-primary';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {detail ?? `${Math.round(value)}%`}
        </span>
      </div>
      <Progress value={value} indicatorClassName={cn(tone)} />
    </div>
  );
}
