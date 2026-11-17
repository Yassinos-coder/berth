import { Controller, type UseFormReturn } from 'react-hook-form';
import { Globe } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { DnsCheckNotice } from '@/features/proxy-hosts/DnsCheckNotice';
import { ProxyHostUrl } from '@/features/proxy-hosts/utils/proxyHostUrl';
import type { ProxyHostFormValues } from '@/features/proxy-hosts/schemas/proxyHostSchema';
import type { Service } from '@/interfaces';

export function ProxyHostForm({
  idPrefix,
  form,
  services,
  servicesLoading,
}: {
  idPrefix: string;
  form: UseFormReturn<ProxyHostFormValues>;
  services: Service[];
  servicesLoading: boolean;
}) {
  const {
    register,
    control,
    watch,
    setValue,
    formState: { errors },
  } = form;
  const values = watch();

  const pickService = (serviceId: string) => {
    const service = services.find((item) => item.id === serviceId);
    setValue('serviceId', serviceId, { shouldValidate: true, shouldDirty: true });
    if (service?.containerPort) {
      setValue('targetPort', String(service.containerPort), {
        shouldValidate: true,
        shouldDirty: true,
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-domain`}>Domain</Label>
        <Input
          id={`${idPrefix}-domain`}
          placeholder="app.example.com"
          aria-invalid={Boolean(errors.domain)}
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          {...register('domain')}
        />
        {values.domain && errors.domain ? (
          <p className="text-destructive text-xs">{errors.domain.message}</p>
        ) : null}
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-path`}>Path</Label>
        <Input
          id={`${idPrefix}-path`}
          placeholder="/ (whole domain)"
          aria-invalid={Boolean(errors.path)}
          className="font-mono"
          autoComplete="off"
          spellCheck={false}
          {...register('path')}
        />
        {errors.path ? (
          <p className="text-destructive text-xs">{errors.path.message}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Leave as <span className="font-mono">/</span> to route the whole
            domain here, or scope this host to a path like{' '}
            <span className="font-mono">/api</span> to share the domain with
            another service.
          </p>
        )}
      </div>

      <div className="space-y-1.5">
        <Label>Target service</Label>
        <Controller
          control={control}
          name="serviceId"
          render={({ field }) => (
            <Select value={field.value} onValueChange={pickService}>
              <SelectTrigger className="w-full" aria-label="Target service">
                <SelectValue
                  placeholder={servicesLoading ? 'Loading…' : 'Select a service'}
                />
              </SelectTrigger>
              <SelectContent>
                {services.map((service) => (
                  <SelectItem key={service.id} value={service.id}>
                    {service.name}
                    <span className="text-muted-foreground">
                      {' '}
                      · {service.serverName}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        />
      </div>

      <div className="space-y-1.5">
        <Label htmlFor={`${idPrefix}-port`}>Container port</Label>
        <Input
          id={`${idPrefix}-port`}
          type="number"
          aria-invalid={Boolean(errors.targetPort)}
          className="w-32 font-mono"
          {...register('targetPort')}
        />
        {errors.targetPort ? (
          <p className="text-destructive text-xs">{errors.targetPort.message}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            The port your app listens on inside its container.
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Automatic HTTPS</p>
          <p className="text-muted-foreground text-xs">
            Issue &amp; auto-renew a Let's Encrypt certificate
          </p>
        </div>
        <Controller
          control={control}
          name="ssl"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onCheckedChange={(ssl) => {
                field.onChange(ssl);
                if (!ssl) setValue('forceHttps', false, { shouldDirty: true });
              }}
              aria-label="Automatic HTTPS"
            />
          )}
        />
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Force HTTPS</p>
          <p className="text-muted-foreground text-xs">Redirect HTTP → HTTPS</p>
        </div>
        <Controller
          control={control}
          name="forceHttps"
          render={({ field }) => (
            <Switch
              checked={field.value && values.ssl}
              onCheckedChange={field.onChange}
              disabled={!values.ssl}
              aria-label="Force HTTPS"
            />
          )}
        />
      </div>

      <p
        className="bg-muted/50 text-muted-foreground flex items-center gap-2 rounded-md px-3 py-2 text-xs"
        data-testid="proxy-host-preview"
      >
        <Globe className="size-3.5 shrink-0" aria-hidden="true" />
        <span>
          Visitors will open{' '}
          <span className="text-foreground font-mono" translate="no">
            {ProxyHostUrl.preview(values)}
          </span>
        </span>
      </p>

      <DnsCheckNotice domain={values.domain} serviceId={values.serviceId} />
    </div>
  );
}
