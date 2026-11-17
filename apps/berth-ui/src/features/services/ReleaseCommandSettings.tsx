import { useEffect, useState } from 'react';
import { Loader2, Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUpdateServiceSettings } from '@/hooks/useServicesMutations';
import { ReleaseCommandRules } from '@/features/services/releaseCommandRules';

export function ReleaseCommandSettings({ serviceId, value }: { serviceId: string; value?: string }) {
  const update = useUpdateServiceSettings(serviceId);
  const [command, setCommand] = useState(value ?? '');

  useEffect(() => setCommand(value ?? ''), [value]);

  const error = ReleaseCommandRules.error(command);
  const dirty = command.trim() !== (value ?? '');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Rocket className="size-4" aria-hidden="true" />
          Release command
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-muted-foreground text-sm">
          Runs once on every deploy, after the build and before the new version starts. Use it for
          database migrations. If it fails, the deploy stops and the current version keeps running.
        </p>
        <div className="space-y-2">
          <Label htmlFor="release-command">Command</Label>
          <Input
            id="release-command"
            value={command}
            onChange={(event) => setCommand(event.target.value)}
            placeholder="npx prisma migrate deploy"
            autoComplete="off"
            spellCheck={false}
            className="font-mono"
            aria-invalid={Boolean(error)}
          />
          {error ? <p className="text-destructive text-xs">{error}</p> : null}
          <p className="text-muted-foreground text-xs">
            One line. Chain steps with &amp;&amp;. It runs with this service&apos;s variables. Leave
            empty to turn it off.
          </p>
        </div>
        <Button
          size="sm"
          disabled={!dirty || Boolean(error) || update.isPending}
          onClick={() => update.mutate({ releaseCommand: command.trim() })}
        >
          {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
          Save release command
        </Button>
      </CardContent>
    </Card>
  );
}
