import { useEffect, useState } from 'react';
import { Loader2, Plus } from 'lucide-react';
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
import { useCreateProxyHost } from '@/hooks/useProxyHostsMutations';
import { useProxyHostForm } from '@/hooks/useProxyHostForm';
import { ProxyHostForm } from '@/features/proxy-hosts/ProxyHostForm';
import {
  emptyProxyHostValues,
  type ProxyHostFormValues,
} from '@/features/proxy-hosts/schemas/proxyHostSchema';

export function AddProxyHostDialog({
  defaultServiceId,
}: {
  defaultServiceId?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const form = useProxyHostForm(emptyProxyHostValues(defaultServiceId ?? ''));
  const services = useServices();
  const create = useCreateProxyHost();

  useEffect(() => {
    if (!defaultServiceId) return;
    const service = services.data?.find((item) => item.id === defaultServiceId);
    if (service?.containerPort) {
      form.setValue('targetPort', String(service.containerPort));
    }
  }, [defaultServiceId, services.data, form]);

  const close = (next: boolean) => {
    setOpen(next);
    if (!next) form.reset(emptyProxyHostValues(defaultServiceId ?? ''));
  };

  const submit = (values: ProxyHostFormValues) => {
    create.mutate(
      {
        domain: values.domain,
        path: values.path || undefined,
        serviceId: values.serviceId,
        targetPort: Number(values.targetPort),
        ssl: values.ssl,
        forceHttps: values.forceHttps && values.ssl,
      },
      { onSuccess: () => close(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" aria-hidden="true" /> Add proxy host
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <form onSubmit={form.handleSubmit(submit)} className="space-y-4" noValidate>
          <DialogHeader>
            <DialogTitle>Add a proxy host</DialogTitle>
            <DialogDescription>
              Route a domain to one of your services over automatic HTTPS.
            </DialogDescription>
          </DialogHeader>

          <ProxyHostForm
            idPrefix="ph"
            form={form}
            services={services.data ?? []}
            servicesLoading={services.isLoading}
          />

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => close(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={create.isPending || !form.formState.isValid}
            >
              {create.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : null}
              Add host
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
