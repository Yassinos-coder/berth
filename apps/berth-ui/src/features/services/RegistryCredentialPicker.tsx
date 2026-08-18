import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useRegistryCredentials } from '@/hooks/useRegistryCredentials';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';

const NONE_VALUE = '__none__';

export function RegistryCredentialPicker({
  serviceId,
  registryCredentialId,
}: {
  serviceId: string;
  registryCredentialId?: string;
}) {
  const credentials = useRegistryCredentials();
  const update = useUpdateServiceSettings(serviceId);
  const [selected, setSelected] = useState(registryCredentialId ?? NONE_VALUE);

  const save = () =>
    update.mutate({
      registryCredentialId: selected === NONE_VALUE ? '' : selected,
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Private registry</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label>Registry credential</Label>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-full sm:w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={NONE_VALUE}>None (public image)</SelectItem>
              {credentials.data?.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name} ({c.server || 'docker.io'})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-muted-foreground text-xs">
            The agent authenticates with this registry before pulling or
            building this service&rsquo;s image. Manage credentials in
            Settings → Security.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button size="sm" onClick={save} disabled={update.isPending}>
            {update.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : null}
            Save
          </Button>
          <span className="text-muted-foreground text-xs">
            Redeploy to apply.
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
