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
import { useAuth, useLogin, useSetupState, useVerifyMfa } from '@/hooks/useAuth';

const credentialsSchema = z.object({
  email: z.string().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
});

type CredentialsForm = z.infer<typeof credentialsSchema>;

const mfaSchema = z.object({
  value: z.string().min(1, 'Enter a code'),
});

type MfaForm = z.infer<typeof mfaSchema>;

export function LoginPage() {
  const { isAuthenticated } = useAuth();
  const setup = useSetupState(!isAuthenticated);
  const login = useLogin();
  const verifyMfa = useVerifyMfa();
  const [useRecoveryCode, setUseRecoveryCode] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CredentialsForm>({ resolver: zodResolver(credentialsSchema) });
  const {
    register: registerMfa,
    handleSubmit: handleMfaSubmit,
    formState: { errors: mfaErrors },
  } = useForm<MfaForm>({ resolver: zodResolver(mfaSchema) });

  if (isAuthenticated) return <Navigate to="/" replace />;
  if (setup.data?.needsSetup) return <Navigate to="/setup" replace />;

  const mfaRequired = login.data && 'mfaRequired' in login.data;

  if (mfaRequired) {
    return (
      <AuthLayout
        title="Two-factor verification"
        subtitle={
          useRecoveryCode
            ? 'Enter one of your saved recovery codes'
            : 'Enter the 6-digit code from your authenticator app'
        }
      >
        <form
          onSubmit={handleMfaSubmit((values) =>
            verifyMfa.mutate(
              useRecoveryCode
                ? { recoveryCode: values.value }
                : { code: values.value },
            ),
          )}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="mfa-value">
              {useRecoveryCode ? 'Recovery code' : 'Verification code'}
            </Label>
            <Input
              id="mfa-value"
              autoFocus
              autoComplete="one-time-code"
              placeholder={useRecoveryCode ? 'XXXX-XXXX' : '123456'}
              aria-invalid={Boolean(mfaErrors.value)}
              {...registerMfa('value')}
            />
            {mfaErrors.value ? (
              <p className="text-destructive text-xs">
                {mfaErrors.value.message}
              </p>
            ) : null}
          </div>
          <Button
            type="submit"
            className="w-full"
            disabled={verifyMfa.isPending}
          >
            {verifyMfa.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Verify
          </Button>
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground w-full text-center text-xs"
            onClick={() => setUseRecoveryCode((v) => !v)}
          >
            {useRecoveryCode
              ? 'Use an authenticator code instead'
              : "Can't access your authenticator? Use a recovery code"}
          </button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Sign in to Berth"
      subtitle="Manage your servers and deployments"
      footer={
        <>
          First time here?{' '}
          <Link to="/setup" className="text-primary font-medium">
            Create the admin account
          </Link>
        </>
      }
    >
      <form
        onSubmit={handleSubmit((values) => login.mutate(values))}
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
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              to="/forgot-password"
              className="text-muted-foreground hover:text-foreground text-xs"
            >
              Forgot password?
            </Link>
          </div>
          <Input
            id="password"
            type="password"
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={Boolean(errors.password)}
            {...register('password')}
          />
          {errors.password ? (
            <p className="text-destructive text-xs">
              {errors.password.message}
            </p>
          ) : null}
        </div>
        <Button type="submit" className="w-full" disabled={login.isPending}>
          {login.isPending ? (
            <Loader2 className="size-4 animate-spin" />
          ) : null}
          Sign in
        </Button>
      </form>
    </AuthLayout>
  );
}
