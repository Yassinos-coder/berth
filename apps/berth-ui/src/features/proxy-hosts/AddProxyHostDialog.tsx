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
import { useServices } from '@/hooks/useServicesQueries';
import { useCreateProxyHost } from '@/hooks/useProxyHostsMutations';

export function AddProxyHostDialog({
  defaultServiceId,
}: {
  defaultServiceId?: string;
} = {}) {
  const [open, setOpen] = useState(false);
  const [domain, setDomain] = useState('');
  const [serviceId, setServiceId] = useState(defaultServiceId ?? '');
  const [targetPort, setTargetPort] = useState('80');
  const [ssl, setSsl] = useState(true);
  const [forceHttps, setForceHttps] = useState(true);
  const services = useServices();
  const create = useCreateProxyHost();

  useEffect(() => {
    if (!defaultServiceId) return;
    const svc = services.data?.find((s) => s.id === defaultServiceId);
    if (svc?.containerPort) setTargetPort(String(svc.containerPort));
  }, [defaultServiceId, services.data]);

  const reset = () => {
    setDomain('');
    setServiceId(defaultServiceId ?? '');
    setTargetPort('80');
    setSsl(true);
    setForceHttps(true);
  };
  const close = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  const pickService = (id: string) => {
    setServiceId(id);
    const svc = services.data?.find((s) => s.id === id);
    if (svc?.containerPort) setTargetPort(String(svc.containerPort));
  };

  const submit = () => {
    if (!domain.trim() || !serviceId) return;
    create.mutate(
      {
        domain: domain.trim(),
        serviceId,
        targetPort: Number(targetPort) || 80,
        ssl,
        forceHttps,
      },
      { onSuccess: () => close(false) },
    );
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="size-4" /> Add proxy host
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Add a proxy host</DialogTitle>
          <DialogDescription>
            Route a domain to one of your services over automatic HTTPS.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ph-domain">Domain</Label>
            <Input
              id="ph-domain"
              placeholder="app.example.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              className="font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Target service</Label>
            <Select value={serviceId} onValueChange={pickService}>
              <SelectTrigger className="w-full">
                <SelectValue
                  placeholder={
                    services.isLoading ? 'Loading…' : 'Select a service'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {(services.data ?? []).map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                    <span className="text-muted-foreground"> · {s.serverName}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ph-port">Container port</Label>
            <Input
              id="ph-port"
              type="number"
              value={targetPort}
              onChange={(e) => setTargetPort(e.target.value)}
              className="w-32 font-mono"
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Automatic HTTPS</p>
              <p className="text-muted-foreground text-xs">
                Issue &amp; auto-renew a Let's Encrypt certificate
              </p>
            </div>
            <Switch checked={ssl} onCheckedChange={setSsl} />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Force HTTPS</p>
              <p className="text-muted-foreground text-xs">
                Redirect HTTP → HTTPS
              </p>
            </div>
            <Switch
              checked={forceHttps}
              onCheckedChange={setForceHttps}
              disabled={!ssl}
            />
          </div>

          <div className="border-warning/40 bg-warning/10 text-warning rounded-lg border px-3 py-2 text-xs">
            Point{' '}
            <span className="font-mono">{domain || 'your domain'}</span>'s DNS
            A record at this server and open ports 80 &amp; 443 before the
            certificate can be issued.
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => close(false)}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={create.isPending || !domain.trim() || !serviceId}
          >
            {create.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : null}
            Add host
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
