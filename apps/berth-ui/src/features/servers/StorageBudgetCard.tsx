import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { HardDrive, Loader2 } from 'lucide-react';
import { StorageMath } from '@berth/protocol';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { StorageBudgetRules } from '@/features/servers/storageBudgetRules';
import { useUpdateServerStorage } from '@/hooks/useServersMutations';
import type { Server } from '@/interfaces';

function Segment({ widthPct, className, label }: { widthPct: number; className: string; label: string }) {
  if (widthPct <= 0) return null;
  return <div className={className} style={{ width: `${widthPct}%` }} title={label} />;
}

export function StorageBudgetCard({ server }: { server: Server }) {
  const update = useUpdateServerStorage(server.id);
  const storage = server.storage;
  const budget = storage?.budgetGb ?? null;
  const allocated = storage?.allocatedGb ?? 0;
  const known = Boolean(server.os) && server.diskGb > 0;
  const min = StorageBudgetRules.minimumBudgetGb(allocated);
  const max = StorageBudgetRules.maximumBudgetGb(known ? server.diskGb : null);

  const schema = z.object({
    storageBudgetGb: z
      .number({ message: 'Enter a number of GB' })
      .int('Use a whole number')
      .min(min, `At least ${min} GB: services already use ${allocated} GB and a share is reserved for images and logs`)
      .max(max, `This server only has ${max} GB of disk`),
  });
  const form = useForm<z.infer<typeof schema>>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: { storageBudgetGb: budget ?? Math.max(min, Math.min(max, 25)) },
  });
  useEffect(() => {
    if (budget !== null) form.reset({ storageBudgetGb: budget });
  }, [budget, form]);

  const value = Number(form.watch('storageBudgetGb')) || 0;
  const reserve = budget === null ? 0 : StorageMath.reserveGb(budget);
  const total = budget ?? 0;
  const pct = (part: number) => (total > 0 ? Math.min(100, (part / total) * 100) : 0);
  const freeForServices = budget === null ? 0 : Math.max(0, StorageMath.allocatableGb(budget) - allocated);
  const dirty = value !== (budget ?? -1);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <HardDrive className="text-muted-foreground size-4" aria-hidden="true" /> Storage for Berth
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {budget === null ? (
          <p className="text-muted-foreground text-sm" data-testid="no-budget">
            No budget is set, so services on this server can use the whole disk. Choose how much Berth may use and
            every service gets a hard limit carved out of it.
          </p>
        ) : (
          <div className="space-y-2" data-testid="storage-bar">
            <div className="bg-muted flex h-3 overflow-hidden rounded-full" role="img" aria-label="Berth storage budget breakdown">
              <Segment widthPct={pct(allocated)} className="bg-primary" label={`Services ${allocated} GB`} />
              <Segment widthPct={pct(reserve)} className="bg-warning/70" label={`Reserved ${reserve} GB`} />
            </div>
            <ul className="text-muted-foreground flex flex-wrap gap-x-4 gap-y-1 text-xs">
              <li><span className="bg-primary mr-1.5 inline-block size-2 rounded-full" />Services {allocated} GB</li>
              <li><span className="bg-warning/70 mr-1.5 inline-block size-2 rounded-full" />Images, cache &amp; logs {reserve} GB</li>
              <li><span className="bg-muted-foreground/40 mr-1.5 inline-block size-2 rounded-full" />Free for services {freeForServices} GB</li>
            </ul>
          </div>
        )}

        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={form.handleSubmit((values) => update.mutate(values.storageBudgetGb))}
          noValidate
        >
          <div className="space-y-1.5">
            <Label htmlFor="server-budget">Budget (GB)</Label>
            <Input
              id="server-budget"
              type="number"
              className="w-28 font-mono"
              aria-invalid={Boolean(form.formState.errors.storageBudgetGb)}
              {...form.register('storageBudgetGb', { valueAsNumber: true })}
            />
          </div>
          <Button type="submit" size="sm" disabled={!dirty || !form.formState.isValid || update.isPending}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            {budget === null ? 'Set budget' : 'Save budget'}
          </Button>
        </form>
        {form.formState.errors.storageBudgetGb ? (
          <p className="text-destructive text-xs">{form.formState.errors.storageBudgetGb.message}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            {known ? `This server has ${server.diskGb} GB of disk. ` : ''}Raising it is instant. Lowering it works as long as
            services still fit.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
