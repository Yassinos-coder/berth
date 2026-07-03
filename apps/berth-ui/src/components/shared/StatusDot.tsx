import { cn } from '@/lib/utils';

type Tone = 'success' | 'warning' | 'destructive' | 'muted' | 'primary';

const TONE: Record<Tone, string> = {
  success: 'bg-success',
  warning: 'bg-warning',
  destructive: 'bg-destructive',
  muted: 'bg-muted-foreground',
  primary: 'bg-primary',
};

export function StatusDot({
  tone,
  pulse = false,
  className,
}: {
  tone: Tone;
  pulse?: boolean;
  className?: string;
}) {
  return (
    <span className={cn('relative flex size-2.5', className)}>
      {pulse ? (
        <span
          className={cn(
            'absolute inline-flex h-full w-full animate-ping rounded-full opacity-60',
            TONE[tone],
          )}
        />
      ) : null}
      <span
        className={cn('relative inline-flex size-2.5 rounded-full', TONE[tone])}
      />
    </span>
  );
}

export type { Tone };
