import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';

export function AlertMuteSettings({ serviceId, muted }: { serviceId: string; muted: boolean }) {
  const update = useUpdateServiceSettings(serviceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Resource alerts</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium">Mute alerts for this service</p>
          <p className="text-muted-foreground text-xs">
            No high CPU or memory notifications will be sent for this service. Useful for batch jobs
            or dev services that run hot on purpose.
          </p>
        </div>
        <Switch
          checked={muted}
          disabled={update.isPending}
          aria-label="Mute alerts for this service"
          onCheckedChange={(alertsMuted) => update.mutate({ alertsMuted })}
        />
      </CardContent>
    </Card>
  );
}
