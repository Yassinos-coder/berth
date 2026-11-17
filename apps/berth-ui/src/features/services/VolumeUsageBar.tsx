import { Progress } from '@/components/ui/progress';
import { VolumeUsageRules } from '@/features/services/volumeUsageRules';

export function VolumeUsageBar({ usage }: { usage: { usedMb: number; totalMb: number; at: string } }) {
  const percent = VolumeUsageRules.percent(usage.usedMb, usage.totalMb);
  const level = VolumeUsageRules.level(percent);
  const stale = VolumeUsageRules.stale(usage.at);

  return (
    <div className="space-y-1.5" data-testid="volume-usage">
      <div className="flex items-baseline justify-between text-sm">
        <span>
          <span className="font-mono font-medium">{VolumeUsageRules.format(usage.usedMb)}</span> used of{' '}
          <span className="font-mono">{VolumeUsageRules.format(usage.totalMb)}</span>
        </span>
        <span className="font-mono text-xs">{percent}%</span>
      </div>
      <Progress
        value={percent}
        aria-label="Storage used"
        className={level === 'critical' ? '[&>div]:bg-destructive' : level === 'warning' ? '[&>div]:bg-warning' : undefined}
      />
      {level !== 'ok' ? (
        <p className={level === 'critical' ? 'text-destructive text-xs' : 'text-muted-foreground text-xs'} role="status">
          {level === 'critical'
            ? 'Almost full. Writes fail at 100%. Increase the size below.'
            : 'Getting full. Consider increasing the size below.'}
        </p>
      ) : null}
      {stale ? <p className="text-muted-foreground text-xs">Last reading is more than 10 minutes old.</p> : null}
    </div>
  );
}
