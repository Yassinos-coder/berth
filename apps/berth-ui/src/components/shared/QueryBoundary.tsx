import type { ReactNode } from 'react';
import { CircleAlert, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface QueryBoundaryProps {
  isLoading: boolean;
  isError: boolean;
  error?: Error | null;
  onRetry?: () => void;
  loadingFallback?: ReactNode;
  children: ReactNode;
}

export function QueryBoundary({
  isLoading,
  isError,
  error,
  onRetry,
  loadingFallback,
  children,
}: QueryBoundaryProps) {
  if (isLoading) {
    return (
      <div aria-live="polite" aria-busy="true">
        {loadingFallback ?? (
          <div className="text-muted-foreground flex items-center justify-center gap-2 py-16 text-sm">
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            Loading…
          </div>
        )}
      </div>
    );
  }

  if (isError) {
    return (
      <div
        role="alert"
        aria-live="polite"
        className="border-destructive/30 bg-destructive/5 flex flex-col items-center justify-center gap-3 rounded-xl border px-6 py-14 text-center"
      >
        <CircleAlert className="text-destructive size-7" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium">
            Couldn’t reach <span translate="no">berth-server</span>
          </p>
          <p className="text-muted-foreground mt-1 text-sm">
            {error?.message ?? 'The panel API is not responding.'} Check that the
            server is running with{' '}
            <code className="font-mono text-xs" translate="no">
              systemctl status berth
            </code>
            , then retry.
          </p>
        </div>
        {onRetry ? (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Retry
          </Button>
        ) : null}
      </div>
    );
  }

  return <>{children}</>;
}
