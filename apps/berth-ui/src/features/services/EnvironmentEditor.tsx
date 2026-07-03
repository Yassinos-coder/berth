import { useState } from 'react';
import { Eye, EyeOff, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { notify } from '@/lib/toast';
import type { EnvVar } from '@berth/protocol';

export function EnvironmentEditor({ initial }: { initial?: EnvVar[] }) {
  const [rows, setRows] = useState<EnvVar[]>(
    initial ?? [{ key: '', value: '', isSecret: false }],
  );
  const [revealed, setRevealed] = useState<Record<number, boolean>>({});

  const update = (i: number, patch: Partial<EnvVar>) =>
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  const remove = (i: number) =>
    setRows((r) => r.filter((_, idx) => idx !== i));
  const add = () =>
    setRows((r) => [...r, { key: '', value: '', isSecret: false }]);

  const save = () => {
    const valid = rows.filter((r) => r.key.trim());
    notify.success(`${valid.length} variables staged`, {
      description: 'Saved variables trigger a reconcile on the next deploy.',
    });
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {rows.map((row, i) => (
            <div key={i} className="flex items-end gap-2">
              <div className="flex-1 space-y-1.5">
                {i === 0 ? (
                  <Label className="text-muted-foreground text-xs">Key</Label>
                ) : null}
                <Input
                  placeholder="DATABASE_URL"
                  value={row.key}
                  onChange={(e) => update(i, { key: e.target.value })}
                  className="font-mono"
                />
              </div>
              <div className="flex-1 space-y-1.5">
                {i === 0 ? (
                  <Label className="text-muted-foreground text-xs">Value</Label>
                ) : null}
                <div className="relative">
                  <Input
                    type={row.isSecret && !revealed[i] ? 'password' : 'text'}
                    placeholder="value"
                    value={row.value}
                    onChange={(e) => update(i, { value: e.target.value })}
                    className="pr-9 font-mono"
                  />
                  {row.isSecret ? (
                    <button
                      type="button"
                      onClick={() =>
                        setRevealed((r) => ({ ...r, [i]: !r[i] }))
                      }
                      className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2"
                    >
                      {revealed[i] ? (
                        <EyeOff className="size-4" />
                      ) : (
                        <Eye className="size-4" />
                      )}
                    </button>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch
                  checked={row.isSecret}
                  onCheckedChange={(v) => update(i, { isSecret: v })}
                  aria-label="Secret"
                />
                <span className="text-muted-foreground w-12 text-xs">
                  Secret
                </span>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => remove(i)}
                  className="text-muted-foreground hover:text-destructive"
                >
                  <Trash2 className="size-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="size-4" /> Add variable
          </Button>
          <Button size="sm" onClick={save}>
            <Save className="size-4" /> Save variables
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
