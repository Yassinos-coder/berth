import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSession, useSetupState } from '@/hooks/useAuth';

function FullScreenLoader() {
  return (
    <div className="bg-background text-muted-foreground flex min-h-screen items-center justify-center">
      <Loader2 className="size-6 animate-spin" />
    </div>
  );
}

export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const session = useSession();
  const setup = useSetupState(session.isError);

  if (session.isLoading) return <FullScreenLoader />;
  if (session.data) return <>{children}</>;

  if (setup.isLoading) return <FullScreenLoader />;
  if (setup.data?.needsSetup) return <Navigate to="/setup" replace />;

  return <Navigate to="/login" state={{ from: location }} replace />;
}
