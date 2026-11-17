import type { UseFormReturn } from 'react-hook-form';
import { HardDrive } from 'lucide-react';
import { StorageMath } from '@berth/protocol';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { OnboardingValues } from '@/features/onboarding/schemas/onboardingSchema';
import { MIN_BUDGET_GB } from '@/features/onboarding/schemas/onboardingSchema';
import type { HostDiskInfo } from '@/interfaces';

export function StorageStep({
  form,
  hostDisk,
}: {
  form: UseFormReturn<OnboardingValues>;
  hostDisk: HostDiskInfo | null | undefined;
}) {
  const { register, watch, setValue, formState: { errors } } = form;
  const budget = Number(watch('storageBudgetGb')) || 0;
  const max = hostDisk ? Math.max(MIN_BUDGET_GB, hostDisk.freeGb) : 1024;
  const valid = budget >= MIN_BUDGET_GB && budget <= max;
  const reserve = valid ? StorageMath.reserveGb(budget) : 0;
  const services = valid ? StorageMath.allocatableGb(budget) : 0;

  return (
    <div className="space-y-5">
      <p className="text-muted-foreground text-sm">
        Choose how much of this server&apos;s disk Berth may use. Every
        service&apos;s persistent storage is carved out of it, and each
        service gets a hard limit it cannot exceed. You can change this later
        under Servers.
      </p>

      {hostDisk ? (
        <p className="bg-muted/50 flex items-center gap-2 rounded-md px-3 py-2 text-xs">
          <HardDrive className="text-muted-foreground size-4 shrink-0" aria-hidden="true" />
          This server has {hostDisk.totalGb} GB of disk, {hostDisk.freeGb} GB free.
        </p>
      ) : null}

      <div className="space-y-2">
        <Label htmlFor="storage-budget">Storage for Berth (GB)</Label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min={MIN_BUDGET_GB}
            max={max}
            step={1}
            value={Math.min(Math.max(budget, MIN_BUDGET_GB), max)}
            onChange={(event) =>
              setValue('storageBudgetGb', Number(event.target.value), { shouldValidate: true })
            }
            aria-label="Storage budget slider"
            className="accent-primary h-2 flex-1 cursor-pointer"
          />
          <Input
            id="storage-budget"
            type="number"
            min={MIN_BUDGET_GB}
            max={max}
            className="w-24 font-mono"
            aria-invalid={Boolean(errors.storageBudgetGb) || !valid}
            {...register('storageBudgetGb', { valueAsNumber: true })}
          />
        </div>
        {errors.storageBudgetGb ? (
          <p className="text-destructive text-xs">{errors.storageBudgetGb.message}</p>
        ) : !valid ? (
          <p className="text-destructive text-xs">
            Choose between {MIN_BUDGET_GB} and {max} GB.
          </p>
        ) : null}
      </div>

      {valid ? (
        <dl className="grid grid-cols-2 gap-3 text-sm" data-testid="storage-breakdown">
          <div className="rounded-lg border p-3">
            <dt className="text-muted-foreground text-xs">For your services</dt>
            <dd className="font-mono text-base">{services} GB</dd>
          </div>
          <div className="rounded-lg border p-3">
            <dt className="text-muted-foreground text-xs">Images, cache &amp; logs</dt>
            <dd className="font-mono text-base">{reserve} GB</dd>
          </div>
        </dl>
      ) : null}
    </div>
  );
}
