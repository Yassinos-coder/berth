import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useResetPassword, useResetTokenPreview } from '@/hooks/useAuth';

const schema = z.object({
  password: z.string().min(8, 'Use at least 8 characters'),
});

type ResetPasswordForm = z.infer<typeof schema>;

export function ResetPasswordPage() {
  const { isAuthenticated } = useAuth();
  const [params] = useSearchParams();
  const token = params.get('token') ?? undefined;
  const preview = useResetTokenPreview(token);
  const resetPassword = useResetPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordForm>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/" replace />;
  if (!token) return <Navigate to="/login" replace />;

  if (preview.isError) {
    return (
      <AuthLayout
        title="Reset link invalid"
        subtitle="This password reset link is invalid or has expired."
        footer={
          <Link to="/forgot-password" className="text-primary font-medium">
            Request a new link
          </Link>
        }
      >
        <p className="text-muted-foreground text-sm">
          Reset links expire after one hour for security.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle={
        preview.data
          ? `Choose a new password for ${preview.data.email}`
          : 'Loadingâ€¦'
      }
    >
      <form
        onSubmit={handleSubmit((values) =>
          resetPassword.mutate({ token, password: values.password }),
        )}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="password">New password</Label>
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
          disabled={!preview.data || resetPassword.isPending}
        >
          {resetPassword.isPending ? (
            <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          ) : null}
          Reset password
        </Button>
        <p className="text-muted-foreground text-xs">
          This signs you out of all other sessions for security.
        </p>
      </form>
    </AuthLayout>
  );
}
