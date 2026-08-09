import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAcceptInvite, useAuth, useInvitePreview } from '@/hooks/useAuth';

const schema = z.object({
  password: z.string().min(8, 'Use at least 8 characters'),
});

type AcceptInviteForm = z.infer<typeof schema>;

export function AcceptInvitePage() {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? undefined;
  const preview = useInvitePreview(token);
  const acceptInvite = useAcceptInvite();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AcceptInviteForm>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/" replace />;
  if (!token) return <Navigate to="/login" replace />;

  if (preview.isError) {
    return (
      <AuthLayout
        title="Invite link invalid"
        subtitle="This invite link is invalid or has expired."
        footer={
          <Link to="/login" className="text-primary font-medium">
            Back to sign in
          </Link>
        }
      >
        <p className="text-muted-foreground text-sm">
          Ask an organization owner or admin to send you a new invite.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="You're invited to Berth"
      subtitle={
        preview.data
          ? `Set a password for ${preview.data.email}`
          : 'Loading your invite…'
      }
    >
      <form
        onSubmit={handleSubmit((values) =>
          acceptInvite.mutate({ token, password: values.password }),
        )}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            aria-invalid={Boolean(errors.password)}
            disabled={!preview.data}
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-destructive text-xs">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={!preview.data || acceptInvite.isPending}
        >
          {acceptInvite.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Join organization
        </Button>
      </form>
    </AuthLayout>
  );
}
