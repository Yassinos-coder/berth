import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth, useForgotPassword } from '@/hooks/useAuth';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});

type ForgotPasswordForm = z.infer<typeof schema>;

export function ForgotPasswordPage() {
  const { isAuthenticated } = useAuth();
  const forgotPassword = useForgotPassword();
  const [submitted, setSubmitted] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordForm>({ resolver: zodResolver(schema) });

  if (isAuthenticated) return <Navigate to="/" replace />;

  if (submitted) {
    return (
      <AuthLayout
        title="Check with your administrator"
        subtitle="If that email has an account, a reset link was generated"
        footer={
          <Link to="/login" className="text-primary font-medium">
            Back to sign in
          </Link>
        }
      >
        <p className="text-muted-foreground text-sm">
          This Berth instance has no email provider configured, so the reset
          link isn&rsquo;t sent automatically. A server administrator can
          retrieve it from the panel logs and share it with you directly.
        </p>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Forgot your password?"
      subtitle="Enter your email and we'll generate a reset link"
      footer={
        <Link to="/login" className="text-primary font-medium">
          Back to sign in
        </Link>
      }
    >
      <form
        onSubmit={handleSubmit((values) =>
          forgotPassword.mutate(values.email, {
            onSuccess: () => setSubmitted(true),
          }),
        )}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            aria-invalid={Boolean(errors.email)}
            {...register('email')}
          />
          {errors.email ? (
            <p className="text-destructive text-xs">{errors.email.message}</p>
          ) : null}
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={forgotPassword.isPending}
        >
          {forgotPassword.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  );
}
