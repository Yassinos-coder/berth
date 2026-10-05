import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  useCreateEnvironment,
  useEnvironments,
  useRemoveEnvironment,
} from '@/hooks/useEnvironments';

export function EnvironmentsSettings() {
  const [name, setName] = useState('');
  const [preview, setPreview] = useState(false);
  const query = useEnvironments();
  const create = useCreateEnvironment();
  const remove = useRemoveEnvironment();

  const add = () =>
    create.mutate(
      { name, preview },
      {
        onSuccess: () => {
          setName('');
          setPreview(false);
        },
      },
    );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Environments</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-muted-foreground text-sm">
          Group services into environments such as Production and Staging. Pull request previews
          go into the environment marked as preview.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            className="max-w-xs"
            aria-label="Environment name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Staging"
          />
          <label className="flex items-center gap-2 text-sm">
            <Switch checked={preview} onCheckedChange={setPreview} aria-label="PR preview" /> PR preview
          </label>
          <Button disabled={!name.trim() || create.isPending} onClick={add}>
            <Plus className="size-4" aria-hidden="true" /> Add
          </Button>
        </div>
        <div className="divide-y rounded-md border">
          {query.data?.map((environment) => (
            <div key={environment.id} className="flex items-center justify-between p-3">
              <div>
                <span className="font-medium">{environment.name}</span>{' '}
                <span className="text-muted-foreground text-sm">/{environment.slug}</span>
                <div className="mt-1 flex gap-1">
                  {environment.isProduction ? <Badge>Production</Badge> : null}
                  {environment.preview ? <Badge variant="secondary">Preview</Badge> : null}
                  <Badge variant="outline">{environment._count.services} services</Badge>
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Delete ${environment.name}`}
                disabled={environment._count.services > 0}
                onClick={() => remove.mutate(environment.id)}
              >
                <Trash2 className="text-destructive size-4" aria-hidden="true" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
