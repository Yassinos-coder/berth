import { z } from 'zod';

export const accountSchema = z.object({
  name: z.string().min(2, 'Enter your name'),
  email: z.string().email('Enter a valid email'),
  password: z.string().min(8, 'Use at least 8 characters'),
});

export const MIN_BUDGET_GB = 5;

export const onboardingSchema = accountSchema.extend({
  storageBudgetGb: z.number().int().min(MIN_BUDGET_GB, `Use at least ${MIN_BUDGET_GB} GB`),
});

export type OnboardingValues = z.infer<typeof onboardingSchema>;

export const ACCOUNT_FIELDS = ['name', 'email', 'password'] as const;
export const STORAGE_FIELDS = ['storageBudgetGb'] as const;
