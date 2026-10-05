import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';

export function PreviewSettings({
  serviceId,
  enabled,
  branch,
}: {
  serviceId: string;
  enabled: boolean;
  branch: string;
}) {
  const update = useUpdateServiceSettings(serviceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Preview environments</CardTitle>
      </CardHeader>
      <CardContent className="flex items-start justify-between gap-4">
        <div className="space-y-1 text-sm">
          <p className="font-medium">Deploy every pull request</p>
          <p className="text-muted-foreground text-xs">
            Opening a pull request into <span className="font-mono">{branch}</span> creates a
            temporary copy of this service built from the PR branch. It is rebuilt on every push
            and deleted when the PR closes. Pull requests from forks are ignored. If this service
            has a domain, the preview is served at <span className="font-mono">pr-N.your-domain</span>{' '}
            (needs a wildcard DNS record). Requires the GitHub App to subscribe to pull request
            events.
          </p>
        </div>
        <Switch
          checked={enabled}
          disabled={update.isPending}
          aria-label="Deploy every pull request"
          onCheckedChange={(checked) => update.mutate({ previewsEnabled: checked })}
        />
      </CardContent>
    </Card>
  );
}
