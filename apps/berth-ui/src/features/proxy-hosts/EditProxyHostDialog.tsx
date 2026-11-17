import { useState } from 'react';
import { Loader2, Pencil } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useServices } from '@/hooks/useServicesQueries';
import { useUpdateProxyHost } from '@/hooks/useProxyHostsMutations';
import { useProxyHostForm } from '@/hooks/useProxyHostForm';
import { ProxyHostForm } from '@/features/proxy-hosts/ProxyHostForm';
import { ProxyHostChanges } from '@/features/proxy-hosts/utils/proxyHostChanges';
import { ProxyHostUrl } from '@/features/proxy-hosts/utils/proxyHostUrl';
import type { ProxyHostFormValues } from '@/features/proxy-hosts/schemas/proxyHostSchema';
import type { ProxyHost } from '@/interfaces';

export function EditProxyHostDialog({ host }: { host: ProxyHost }) {
  const [open, setOpen] = useState(false);
  const form = useProxyHostForm(ProxyHostChanges.toFormValues(host));
  const services = useServices();
  const update = useUpdateProxyHost(host.id);

  const changes = ProxyHostChanges.diff(host, form.watch());
  const hasChanges = Object.keys(changes).length > 0;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) form.reset(ProxyHostChanges.toFormValues(host));
  };

  const submit = (values: ProxyHostFormValues) => {
    const payload = ProxyHostChanges.diff(host, values);
    if (Object.keys(payload).length === 0) return;
    update.mutate(payload, { onSuccess: () => setOpen(false) });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground"
          aria-label={`Edit proxy host ${ProxyHostUrl.label(host)}`}
        >
          <Pencil className="size-4" aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Edit proxy host</DialogTitle>
            <DialogDescription>
              Change the domain, path, target or HTTPS settings. The proxy
              applies the change as soon as the agent reconciles.
            </DialogDescription>
          </DialogHeader>

          <ProxyHostForm
            idPrefix={`ph-edit-${host.id}`}
            form={form}
            services={services.data ?? []}
            servicesLoading={services.isLoading}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={update.isPending || !hasChanges || !form.formState.isValid}
            >
              {update.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Save changes
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
