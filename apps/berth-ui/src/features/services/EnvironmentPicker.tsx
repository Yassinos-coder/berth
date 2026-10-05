import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useAssignEnvironment, useEnvironments } from '@/hooks/useEnvironments';

const NONE = 'none';

export function EnvironmentPicker({
  serviceId,
  environmentId,
}: {
  serviceId: string;
  environmentId?: string;
}) {
  const environments = useEnvironments();
  const assign = useAssignEnvironment(serviceId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Environment</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <Select
          value={environmentId ?? NONE}
          disabled={assign.isPending || environments.isLoading}
          onValueChange={(value) => assign.mutate(value === NONE ? null : value)}
        >
          <SelectTrigger className="w-full sm:w-64" aria-label="Environment">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>No environment</SelectItem>
            {(environments.data ?? []).map((environment) => (
              <SelectItem key={environment.id} value={environment.id}>
                {environment.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-muted-foreground text-xs">
          Environments group services on the Services page. Create them under Settings → Environments.
        </p>
      </CardContent>
    </Card>
  );
}
