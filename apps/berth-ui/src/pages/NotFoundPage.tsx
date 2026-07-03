import { Link } from 'react-router-dom';
import { Compass } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="bg-background flex min-h-screen flex-col items-center justify-center px-4 text-center">
      <div className="bg-muted text-muted-foreground mb-6 flex size-14 items-center justify-center rounded-2xl">
        <Compass className="size-7" />
      </div>
      <p className="text-primary text-sm font-semibold">404</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">
        Off the map
      </h1>
      <p className="text-muted-foreground mt-1.5 max-w-sm text-sm">
        This berth doesn’t exist. It may have been removed or the link is wrong.
      </p>
      <Button asChild className="mt-6">
        <Link to="/">Back to overview</Link>
      </Button>
    </div>
  );
}
