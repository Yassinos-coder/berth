import type { LucideIcon } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

interface StatTileProps {
  label: string;
  value: string | number;
  hint?: string;
  icon: LucideIcon;
  accent?: 'primary' | 'success' | 'warning' | 'destructive';
}

const ACCENT: Record<NonNullable<StatTileProps['accent']>, string> = {
  primary: 'text-primary bg-primary/10',
  success: 'text-success bg-success/10',
  warning: 'text-warning bg-warning/10',
  destructive: 'text-destructive bg-destructive/10',
};

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent = 'primary',
}: StatTileProps) {
  return (
    <Card className="gap-0 p-5">
      <div className="flex items-center justify-between">
        <span className="text-muted-foreground text-sm font-medium">
          {label}
        </span>
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-lg',
            ACCENT[accent],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <div className="mt-3 flex items-baseline gap-2">
        <span className="text-3xl font-semibold tracking-tight tabular-nums">
          {value}
        </span>
        {hint ? (
          <span className="text-muted-foreground text-xs">{hint}</span>
        ) : null}
      </div>
    </Card>
  );
}
