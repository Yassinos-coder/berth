import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';

export function StepIndicator({
  steps,
  current,
}: {
  steps: string[];
  current: number;
}) {
  return (
    <ol className="mb-6 flex items-center justify-center gap-2" aria-label="Setup progress">
      {steps.map((label, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={label} className="flex items-center gap-2" aria-current={active ? 'step' : undefined}>
            <span
              className={cn(
                'flex size-6 items-center justify-center rounded-full border text-xs font-medium',
                done && 'border-primary bg-primary text-primary-foreground',
                active && 'border-primary text-primary',
                !done && !active && 'text-muted-foreground',
              )}
            >
              {done ? <Check className="size-3.5" aria-hidden="true" /> : index + 1}
            </span>
            <span className={cn('text-xs', active ? 'text-foreground font-medium' : 'text-muted-foreground')}>
              {label}
            </span>
            {index < steps.length - 1 ? <span className="bg-border mx-1 h-px w-6" aria-hidden="true" /> : null}
          </li>
        );
      })}
    </ol>
  );
}
