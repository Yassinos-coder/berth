import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { AuthLayout } from '@/features/auth/AuthLayout';
import { AccountStep } from '@/features/onboarding/components/AccountStep';
import { StorageStep } from '@/features/onboarding/components/StorageStep';
import { AdvisorStep } from '@/features/onboarding/components/AdvisorStep';
import { AdvisorDraftRules, type AdvisorDraft } from '@/features/advisor/advisorDraft';
import { advisorService } from '@/services/advisorService';
import { notify } from '@/lib/toast';
import { StepIndicator } from '@/features/onboarding/components/StepIndicator';
import {
  ACCOUNT_FIELDS,
  MIN_BUDGET_GB,
  STORAGE_FIELDS,
  onboardingSchema,
  type OnboardingValues,
} from '@/features/onboarding/schemas/onboardingSchema';
import { Button } from '@/components/ui/button';
import { useAuth, useRegister, useSetupState } from '@/hooks/useAuth';

const STEPS = ['Account', 'Storage', 'AI advisor'];

const TITLES = [
  { title: 'Create your admin account', subtitle: 'This becomes the owner of your Berth panel' },
  { title: 'Choose your storage', subtitle: 'Decide how much of this disk Berth may use' },
  { title: 'AI advisor', subtitle: 'Optional: get safe suggestions to improve your setup' },
];

export function OnboardingPage() {
  const { isAuthenticated } = useAuth();
  const registerAdmin = useRegister();
  const setup = useSetupState();
  const [step, setStep] = useState(0);
  const [advisor, setAdvisor] = useState<AdvisorDraft>(() => AdvisorDraftRules.initial());
  const hostDisk = setup.data?.hostDisk;

  const form = useForm<OnboardingValues>({
    resolver: zodResolver(onboardingSchema),
    mode: 'onTouched',
    defaultValues: {
      name: '',
      email: '',
      password: '',
      storageBudgetGb: hostDisk?.suggestedBudgetGb ?? 25,
    },
  });

  useEffect(() => {
    if (!hostDisk || form.formState.dirtyFields.storageBudgetGb) return;
    form.setValue('storageBudgetGb', hostDisk.suggestedBudgetGb);
  }, [hostDisk, form]);

  if (isAuthenticated) return <Navigate to="/" replace />;

  const isLast = step === STEPS.length - 1;
  const budgetTooBig = (value: number) => Boolean(hostDisk) && value > (hostDisk?.freeGb ?? 0);

  const next = async () => {
    const fields = step === 0 ? ACCOUNT_FIELDS : STORAGE_FIELDS;
    const valid = await form.trigger([...fields]);
    if (!valid) return;
    if (step === 1 && budgetTooBig(form.getValues('storageBudgetGb'))) {
      form.setError('storageBudgetGb', { message: `This server has ${hostDisk?.freeGb} GB free.` });
      return;
    }
    setStep((current) => current + 1);
  };

  const submit = form.handleSubmit((values) => {
    if (budgetTooBig(values.storageBudgetGb)) {
      form.setError('storageBudgetGb', {
        message: `This server has ${hostDisk?.freeGb} GB free.`,
      });
      return;
    }
    if (AdvisorDraftRules.error(advisor, false)) return;
    registerAdmin.mutate(values, {
      onSuccess: () => {
        if (!advisor.enabled) return;
        advisorService.updateSettings(AdvisorDraftRules.toPayload(advisor)).catch((error: Error) =>
          notify.error('Could not save the advisor settings', {
            description: `${error.message} You can set it up again in Settings.`,
          }),
        );
      },
    });
  });
  const advisorError = step === 2 ? AdvisorDraftRules.error(advisor, false) : null;

  return (
    <AuthLayout
      wide
      title={TITLES[step].title}
      subtitle={TITLES[step].subtitle}
      footer={
        <>
          Already set up?{' '}
          <Link to="/login" className="text-primary font-medium">
            Sign in
          </Link>
        </>
      }
    >
      <StepIndicator steps={STEPS} current={step} />
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (isLast) void submit();
          else void next();
        }}
        className="space-y-6"
        noValidate
      >
        {step === 0 ? <AccountStep form={form} /> : null}
        {step === 1 ? <StorageStep form={form} hostDisk={hostDisk} /> : null}
        {step === 2 ? <AdvisorStep draft={advisor} onChange={setAdvisor} error={advisorError} /> : null}

        <div className="flex items-center justify-between gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStep((current) => current - 1)}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={registerAdmin.isPending || Boolean(advisorError)}>
            {registerAdmin.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            {isLast ? 'Create account' : 'Continue'}
          </Button>
        </div>
        {step === 1 ? (
          <p className="text-muted-foreground text-center text-xs">
            The minimum is {MIN_BUDGET_GB} GB. You can change this any time.
          </p>
        ) : null}
      </form>
    </AuthLayout>
  );
}
