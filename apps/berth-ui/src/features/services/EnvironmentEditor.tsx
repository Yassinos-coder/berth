import { useEffect, useState } from 'react';
import { Code2, Eye, EyeOff, Loader2, Plus, Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { CopyButton } from '@/components/shared/CopyButton';
import { EnvPasteDialog } from '@/features/services/EnvPasteDialog';
import { EnvRawEditor } from '@/features/services/EnvRawEditor';
import { EnvText } from '@/features/services/envText';
import { QueryBoundary } from '@/components/shared/QueryBoundary';
import { Skeleton } from '@/components/ui/skeleton';
import {
  useServiceEnv,
} from '@/hooks/useServicesQueries';
import { useServiceAction, useSetServiceEnv } from '@/hooks/useServicesMutations';
import type { EnvVar } from '@berth/protocol';

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
  const [editingText, setEditingText] = useState(false);
  const setEnv = useSetServiceEnv(serviceId);
  const redeploy = useServiceAction(serviceId);

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

  const applyText = (vars: EnvVar[]) => {
    setRows((current) => {
      const ids = new Map(current.map((row) => [row.key, row.rowId]));
      const next = toRows(vars).map((row) => ({
        ...row,
        rowId: ids.get(row.key) ?? row.rowId,
      }));
      return next.length > 0 ? next : [blankRow()];
    });
    setEditingText(false);
  };

  const validRows = () =>
    rows
      .filter((r) => r.key.trim())
      .map(({ key, value, isSecret }) => ({ key, value, isSecret }));
  const save = () => setEnv.mutate(validRows());
  const saveAndRedeploy = () =>
    setEnv.mutate(validRows(), { onSuccess: () => redeploy.mutate('redeploy') });

  return (
    <Card>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-muted-foreground text-sm">
            Passed to the container on the next deploy. Secrets are encrypted at
            rest. Reference another service on the same server with{' '}
            <code className="text-xs">{'${{service-name.VARIABLE}}'}</code>; HOST
            and PORT are available too.
          </p>
          <div className="flex items-center gap-2">
            <CopyButton value={EnvText.serialize(rows, 'dotenv', true)} label="Copy .env" />
            <Button variant="outline" size="sm" onClick={() => setEditingText((value) => !value)} aria-pressed={editingText}>
              <Code2 className="size-4" aria-hidden="true" /> Edit as text
            </Button>
            <EnvPasteDialog onImport={importVars} />
          </div>
        </div>

        {editingText ? (
          <EnvRawEditor
            rows={rows.filter((row) => row.key.trim())}
            onApply={applyText}
            onCancel={() => setEditingText(false)}
          />
        ) : null}

        <div className={editingText ? 'hidden' : 'space-y-3'}>
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

        <div className={editingText ? 'hidden' : 'flex items-center justify-between'}>
          <Button variant="outline" size="sm" onClick={add}>
            <Plus className="size-4" aria-hidden="true" /> Add Variable
          </Button>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={save} disabled={setEnv.isPending}>
              {setEnv.isPending ? (
                <Loader2 className="size-4 animate-spin" aria-hidden="true" />
              ) : (
                <Save className="size-4" aria-hidden="true" />
              )}
              {setEnv.isPending ? 'Saving…' : 'Save Variables'}
            </Button>
            <Button
              size="sm"
              onClick={saveAndRedeploy}
              disabled={setEnv.isPending || redeploy.isPending}
            >
              Save &amp; Redeploy
            </Button>
          </div>
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
