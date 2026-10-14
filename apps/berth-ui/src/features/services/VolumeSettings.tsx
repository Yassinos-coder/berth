import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';

interface VolumeSettingsProps {
  serviceId: string;
  volumePath?: string;
  managedByTemplate: boolean;
}

export function VolumeSettings({ serviceId, volumePath, managedByTemplate }: VolumeSettingsProps) {
  const [path, setPath] = useState(volumePath ?? '');
  const update = useUpdateServiceSettings(serviceId);
  const unchanged = path.trim() === (volumePath ?? '');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Persistent volume</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="volume-path">Mount path inside the container</Label>
          <div className="flex items-center gap-3">
            <Input
              id="volume-path"
              placeholder="/app/data"
              value={path}
              disabled={managedByTemplate}
              onChange={(event) => setPath(event.target.value)}
            />
            <Button
              size="sm"
              disabled={managedByTemplate || unchanged || update.isPending}
              onClick={() => update.mutate({ volumePath: path.trim() })}
            >
              Save
            </Button>
          </div>
        </div>
        <p className="text-muted-foreground text-xs">
          {managedByTemplate
            ? 'This volume is managed by the template.'
            : 'Files written here survive redeploys and restarts. Clearing the path unmounts the volume but keeps its data. Redeploy to apply changes.'}
        </p>
      </CardContent>
    </Card>
  );
}
