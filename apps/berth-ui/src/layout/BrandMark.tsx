import { Anchor } from 'lucide-react';
import { cn } from '@/lib/utils';

export function BrandMark({
  collapsed = false,
  className,
}: {
  collapsed?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <div className="bg-primary text-primary-foreground flex size-8 shrink-0 items-center justify-center rounded-lg shadow-sm">
        <Anchor className="size-4.5" strokeWidth={2.5} />
      </div>
      {!collapsed ? (
        <div className="leading-none">
          <span className="text-[15px] font-semibold tracking-tight">
            Berth
          </span>
        </div>
      ) : null}
    </div>
  );
}
