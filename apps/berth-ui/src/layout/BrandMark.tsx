import { cn } from '@/lib/utils';

function CleatMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M6 9 C7.5 12 10 13 16 13 C22 13 24.5 12 26 9" />
      <path d="M16 13 V24" />
      <ellipse cx="16" cy="25" rx="6.5" ry="1.9" />
      <path d="M16 18 C11.5 14.5 7 16 7 18.5 C7 21 11.5 22 16 18 C20.5 14 25 15.5 25 18 C25 20.5 20.5 21.5 16 18 Z" />
    </svg>
  );
}

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
        <CleatMark className="size-5" />
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
