import { ArrowUpCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CopyButton } from '@/components/shared/CopyButton';
import { useVersion, useStartUpdate } from '@/hooks/useSystemQueries';
import { useAuth } from '@/hooks/useAuth';

const UPDATE_COMMAND = 'sudo berth-update';

export function Footer() {
  const { data } = useVersion();
  const { user } = useAuth();
  const startUpdate = useStartUpdate();
  const canUpdate = user?.role === 'owner' || user?.role === 'admin';

  return (
    <footer className="border-border/60 text-muted-foreground mt-auto flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-xs sm:flex-row md:px-8">
      <span>
        Berth
        {data ? ` v${data.version}` : ''}
        {data?.commit ? (
          <span className="text-muted-foreground/70"> · {data.commit}</span>
        ) : null}
      </span>

      {data?.updateAvailable ? (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-primary inline-flex items-center gap-1.5 font-medium">
            <ArrowUpCircle className="size-3.5" aria-hidden="true" />
            Update available
          </span>
          <CopyButton value={UPDATE_COMMAND} label="Copy command" />
          {canUpdate ? (
            <Button
              size="sm"
              onClick={() => startUpdate.mutate()}
              disabled={startUpdate.isPending}
            >
              {startUpdate.isPending ? (
                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
              ) : null}
              Update now
            </Button>
          ) : null}
        </div>
      ) : null}
    </footer>
  );
}
