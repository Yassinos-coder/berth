import { Link } from 'react-router-dom';
import { Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAdvisorSummary } from '@/hooks/useAdvisor';

export function AdvisorBell() {
  const summary = useAdvisorSummary();
  if (!summary.data?.enabled) return null;
  const count = summary.data.openCount;
  const label = count > 0 ? `AI advisor, ${count} suggestion${count === 1 ? '' : 's'}` : 'AI advisor';

  return (
    <Button asChild variant="ghost" size="icon" className="relative" aria-label={label}>
      <Link to="/advisor">
        <Sparkles className="size-4" aria-hidden="true" />
        {count > 0 ? (
          <span
            data-testid="advisor-badge"
            className={`absolute -top-0.5 -right-0.5 flex min-w-4 items-center justify-center rounded-full px-1 text-[10px] leading-4 font-semibold text-white ${
              summary.data.criticalCount > 0 ? 'bg-destructive' : 'bg-primary'
            }`}
          >
            {count > 99 ? '99+' : count}
          </span>
        ) : null}
      </Link>
    </Button>
  );
}
