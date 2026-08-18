import { useEffect, useState } from 'react';
import { Eye, EyeOff, FileText, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { CopyButton } from '@/components/shared/CopyButton';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useServiceEnv,
} from '@/hooks/useServicesQueries';
import { useSetServiceEnv } from '@/hooks/useServicesMutations';
import type { EnvVar } from '@berth/protocol';

const SECRET_HINT = /(SECRET|TOKEN|PASSWORD|PRIVATE|CREDENTIAL|_KEY|APIKEY|PASS)/i;

function parseDotenv(text: string): EnvVar[] {
  const out: EnvVar[] = [];
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith('export ')) key = key.slice(7).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    out.push({ key, value, isSecret: SECRET_HINT.test(key) });
  }
  return out;
}

function toDotenv(rows: EnvVar[]): string {
  return rows
    .filter((row) => row.key.trim())
    .map((row) => {
      const needsQuotes = row.value === '' || /[\s#"]/.test(row.value);
      const value = needsQuotes
        ? `"${row.value.replace(/"/g, '\\"')}"`
        : row.value;
      return `${row.key}=${value}`;
    })
    .join('\n');
}

function BulkPaste({ onImport }: { onImport: (vars: EnvVar[]) => void }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');

  const apply = () => {
    const parsed = parseDotenv(text);
    onImport(parsed);
    setText('');
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <FileText className="size-4" aria-hidden="true" /> Paste .env
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Paste a .env file</DialogTitle>
          <DialogDescription>
            One <code>KEY=value</code> per line. Existing keys are overwritten;
            new keys are added. Keys that look like secrets are marked secret
            automatically.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="dotenv-paste">Variables</Label>
          <textarea
            id="dotenv-paste"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={10}
            spellCheck={false}
            autoCapitalize="off"
            autoCorrect="off"
            autoComplete="off"
            data-1p-ignore
            data-lpignore="true"
            placeholder={'DATABASE_URL=postgres://…\nSUPABASE_ANON_KEY=…'}
            className="border-input bg-background focus-visible:ring-ring/40 w-full rounded-md border p-3 font-mono text-xs outline-none focus-visible:ring-[3px]"
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!text.trim()}>
            Import Variables
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface EnvRow extends EnvVar {
  rowId: string;
}

function toRows(vars: EnvVar[]): EnvRow[] {
  return vars.map((v) => ({ ...v, rowId: crypto.randomUUID() }));
}

function blankRow(): EnvRow {
  return { key: '', value: '', isSecret: false, rowId: crypto.randomUUID() };
}

function Editor({ serviceId, initial }: { serviceId: string; initial: EnvVar[] }) {
  const [rows, setRows] = useState<EnvRow[]>(() =>
    initial.length > 0 ? toRows(initial) : [blankRow()],
  );
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const setEnv = useSetServiceEnv(serviceId);

  const update = (rowId: string, patch: Partial<EnvVar>) =>
    setRows((r) =>
      r.map((row) => (row.rowId === rowId ? { ...row, ...patch } : row)),
    );
  const remove = (rowId: string) => {
    setRows((r) => r.filter((row) => row.rowId !== rowId));
    setRevealed((current) => {
      const next = { ...current };
      delete next[rowId];
      return next;
    });
  };
  const add = () => setRows((r) => [...r, blankRow()]);

  const importVars = (vars: EnvVar[]) =>
    setRows((current) => {
      const byKey = new Map<string, EnvRow>();
      for (const row of current) if (row.key.trim()) byKey.set(row.key, row);
      for (const v of vars) {
        const existing = byKey.get(v.key);
        byKey.set(v.key, { ...v, rowId: existing?.rowId ?? crypto.randomUUID() });
      }
      return Array.from(byKey.values());
    });

  const save = () => {
    const valid = rows
      .filter((r) => r.key.trim())
      .map(({ key, value, isSecret }) => ({ key, value, isSecret }));
    setEnv.mutate(valid);
  };

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Passed to the container on the next deploy. Secrets are encrypted at
            rest.
          </p>
          <div className="flex items-center gap-2">
            <CopyButton value={toDotenv(rows)} label="Copy .env" />
            <BulkPaste onImport={importVars} />
          </div>
        </div>

        <div className="space-y-3">
          {rows.map((row, i) => {
            const label = row.key.trim() || `variable ${i + 1}`;
            return (
              <div key={row.rowId} className="flex items-end gap-2">
                <div className="flex-1 space-y-1.5">
                  {i === 0 ? (
                    <span className="text-muted-foreground text-xs font-medium">
                      Key
                    </span>
                  ) : null}
                  <Input
                    aria-label={`Key for ${label}`}
                    placeholder="DATABASE_URL"
                    value={row.key}
                    onChange={(e) => update(row.rowId, { key: e.target.value })}
                    autoComplete="off"
                    autoCapitalize="off"
                    autoCorrect="off"
                    spellCheck={false}
                    className="font-mono"
                  />
                </div>
                <div className="flex-1 space-y-1.5">
                  {i === 0 ? (
                    <span className="text-muted-foreground text-xs font-medium">
                      Value
                    </span>
                  ) : null}
                  <div className="relative">
                    <Input
                      type={
                        row.isSecret && !revealed[row.rowId] ? 'password' : 'text'
                      }
                      aria-label={`Value for ${label}`}
                      placeholder="value"
                      value={row.value}
                      onChange={(e) =>
                        update(row.rowId, { value: e.target.value })
                      }
                      autoComplete="off"
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      data-1p-ignore
                      data-lpignore="true"
                      className="pr-9 font-mono"
                    />
                    {row.isSecret ? (
                      <button
                        type="button"
                        onClick={() =>
                          setRevealed((r) => ({
                            ...r,
                            [row.rowId]: !r[row.rowId],
                          }))
                        }
                        aria-label={
                          revealed[row.rowId]
                            ? `Hide value for ${label}`
                            : `Reveal value for ${label}`
                        }
                        aria-pressed={Boolean(revealed[row.rowId])}
                        className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/40 absolute top-1/2 right-2 -translate-y-1/2 rounded-sm outline-none focus-visible:ring-[3px]"
                      >
                        {revealed[row.rowId] ? (
                          <EyeOff className="size-4" aria-hidden="true" />
                        ) : (
                          <Eye className="size-4" aria-hidden="true" />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex items-center gap-2 pb-2">
                  <Switch
                    checked={row.isSecret}
                    onCheckedChange={(v) => update(row.rowId, { isSecret: v })}
                    aria-label={`Mark ${label} as secret`}
                  />
                  <span className="text-muted-foreground w-12 text-xs">
                    Secret
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(row.rowId)}
                    aria-label={`Delete ${label}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="size-4" aria-hidden="true" /> Add Variable
          </Button>
          <Button size="sm" onClick={save} disabled={setEnv.isPending}>
            {setEnv.isPending ? (
              <Loader2 className="size-4 animate-spin" aria-hidden="true" />
            ) : (
              <Save className="size-4" aria-hidden="true" />
            )}
            {setEnv.isPending ? 'Saving…' : 'Save Variables'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export function EnvironmentEditor({ serviceId }: { serviceId: string }) {
  const env = useServiceEnv(serviceId);
  // Remount the editor when server data loads so it seeds from the latest env.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (env.data && !seeded) setSeeded(true);
  }, [env.data, seeded]);

  return (
    <QueryBoundary
      isLoading={env.isLoading}
      isError={env.isError}
      error={env.error}
      onRetry={() => env.refetch()}
      loadingFallback={<Skeleton className="h-64" />}
    >
      <Editor
        key={seeded ? 'ready' : 'loading'}
        serviceId={serviceId}
        initial={env.data ?? []}
      />
    </QueryBoundary>
  );
}
