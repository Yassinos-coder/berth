import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { Loader2, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { VolumeUsageBar } from '@/features/services/VolumeUsageBar';
import { StorageSettingsRules } from '@/features/services/storageSettingsRules';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';
import type { Server, Service } from '@/interfaces';

const PRESETS = [1, 5, 10, 25, 50];

interface FormValues {
  sizeGb: number;
}

export function StorageSettings({ service, server }: { service: Service; server?: Server }) {
  const update = useUpdateServiceSettings(service.id);
  const limited = service.diskLimited === true;
  const currentGb = service.diskGb ?? 0;
  const freeGb = server?.storage?.freeGb ?? null;
  const form = useForm<FormValues>({ defaultValues: { sizeGb: currentGb || 5 }, mode: 'onChange' });
  const size = Number(form.watch('sizeGb'));

  useEffect(() => {
    form.reset({ sizeGb: currentGb || 5 });
  }, [currentGb, form]);

  if (!service.volumePath) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Storage size</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">
            This service has no persistent storage, which is right for a stateless backend. Add a mount path above if it
            needs to keep files between deploys.
          </p>
        </CardContent>
      </Card>
    );
  }

  const sizeError = StorageSettingsRules.sizeError(size);
  const growth = limited ? StorageSettingsRules.growthProblem(size, currentGb, freeGb) : StorageSettingsRules.growthProblem(size, 0, freeGb);
  const change = StorageSettingsRules.change(size, currentGb);
  const problem = sizeError ?? growth;

  const apply = () => update.mutate({ diskGb: size });
  const enforce = () => update.mutate({ diskGb: size, enforceDiskLimit: true });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Storage size</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {limited && service.volumeUsage ? <VolumeUsageBar usage={service.volumeUsage} /> : null}
        {limited ? (
          <p className="text-sm">
            Limited to <span className="font-mono font-medium" data-testid="current-limit">{currentGb} GB</span>. The service
            cannot write past it.
          </p>
        ) : (
          <div className="border-warning/40 bg-warning/10 flex gap-2 rounded-lg border p-3 text-sm" data-testid="unlimited-notice">
            <TriangleAlert className="text-warning mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p>
              This volume has <strong>no size limit</strong>: it can grow until the disk is full. Enforce a limit to
              protect the rest of the server.
            </p>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="service-storage-size">{limited ? 'New size (GB)' : 'Limit (GB)'}</Label>
          <div className="flex flex-wrap items-center gap-2">
            {PRESETS.map((preset) => (
              <button
                key={preset}
                type="button"
                aria-pressed={size === preset}
                onClick={() => form.setValue('sizeGb', preset, { shouldValidate: true })}
                className="hover:border-primary/40 aria-pressed:border-primary aria-pressed:bg-primary/5 focus-visible:ring-ring/40 rounded-md border px-2.5 py-1 font-mono text-xs outline-none focus-visible:ring-[3px]"
              >
                {preset} GB
              </button>
            ))}
            <Input
              id="service-storage-size"
              type="number"
              className="w-24 font-mono"
              aria-invalid={Boolean(problem)}
              {...form.register('sizeGb', { valueAsNumber: true })}
            />
          </div>
          {problem ? (
            <p className="text-destructive text-xs" role="alert">{problem}</p>
          ) : limited && change === 'grow' ? (
            <p className="text-muted-foreground text-xs">Your data is kept. The service restarts briefly to apply the new size.</p>
          ) : limited && change === 'shrink' ? (
            <p className="text-muted-foreground text-xs">
              Shrinking works only if your data fits in the new size; otherwise the deploy fails and the service keeps running as before.
            </p>
          ) : null}
        </div>

        {limited ? (
          <Button size="sm" disabled={change === 'same' || Boolean(problem) || update.isPending} onClick={apply}>
            {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
            Apply size
          </Button>
        ) : (
          <ConfirmDialog
            trigger={
              <Button size="sm" disabled={Boolean(problem) || update.isPending}>
                {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Enforce limit
              </Button>
            }
            title={`Limit ${service.name} to ${size} GB?`}
            description={
              <>
                Berth copies this volume into a new {size} GB one and switches the service to it. The service restarts, so
                expect a short outage. Your original volume is left untouched as a backup, so delete it yourself when you
                are happy, to free the space.
              </>
            }
            confirmLabel="Enforce limit"
            isPending={update.isPending}
            onConfirm={enforce}
          />
        )}
      </CardContent>
    </Card>
  );
}
