import {
  CircleCheck,
  CircleX,
  Info,
  TriangleAlert,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export type ToastLevel = 'info' | 'warn' | 'error' | 'success';

const LEVEL_CONFIG: Record<
  ToastLevel,
  { icon: LucideIcon; ring: string; iconColor: string; bar: string }
> = {
  info: {
    icon: Info,
    ring: 'border-primary/30',
    iconColor: 'text-primary',
    bar: 'bg-primary',
  },
  warn: {
    icon: TriangleAlert,
    ring: 'border-warning/40',
    iconColor: 'text-warning',
    bar: 'bg-warning',
  },
  error: {
    icon: CircleX,
    ring: 'border-destructive/40',
    iconColor: 'text-destructive',
    bar: 'bg-destructive',
  },
  success: {
    icon: CircleCheck,
    ring: 'border-success/40',
    iconColor: 'text-success',
    bar: 'bg-success',
  },
};

interface AlertToastProps {
  level: ToastLevel;
  title: string;
  description?: string;
  onDismiss?: () => void;
}

export function AlertToast({
  level,
  title,
  description,
  onDismiss,
}: AlertToastProps) {
  const { icon: Icon, ring, iconColor, bar } = LEVEL_CONFIG[level];
  return (
    <div
      role="alert"
      className={cn(
        'bg-popover text-popover-foreground relative flex w-full items-start gap-3 overflow-hidden rounded-lg border py-3 pr-3 pl-4 shadow-lg md:w-[364px]',
        ring,
      )}
    >
      <span className={cn('absolute inset-y-0 left-0 w-1', bar)} />
      <Icon className={cn('mt-0.5 size-5 shrink-0', iconColor)} />
      <div className="flex-1 space-y-0.5">
        <p className="text-sm font-medium leading-tight">{title}</p>
        {description ? (
          <p className="text-muted-foreground text-sm leading-snug">
            {description}
          </p>
        ) : null}
      </div>
      {onDismiss ? (
        <button
          type="button"
          onClick={onDismiss}
          className="text-muted-foreground hover:text-foreground -mr-1 rounded-sm p-1 transition-colors"
          aria-label="Dismiss"
        >
          <X className="size-4" />
        </button>
      ) : null}
    </div>
  );
}
