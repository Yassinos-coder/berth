import { useEffect, useState } from 'react';
import { BellRing, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { useAlertSettings, useUpdateAlertSettings } from '@/hooks/useAlertSettings';
import {
  AlertSettingsForm,
  type AlertSettingsDraft,
} from '@/features/alerts/utils/alertSettingsForm';

const FIELDS: { key: 'cpuPct' | 'memPct' | 'diskPct' | 'minutes'; label: string; unit: string; hint: string }[] = [
  { key: 'cpuPct', label: 'CPU', unit: '%', hint: 'Of the service CPU allocation' },
  { key: 'memPct', label: 'Memory', unit: '%', hint: 'Of the service memory limit' },
  { key: 'diskPct', label: 'Server disk', unit: '%', hint: 'Of the server disk' },
  { key: 'minutes', label: 'Sustained for', unit: 'min', hint: 'CPU and memory only' },
];

export function AlertSettingsCard({ canManage }: { canManage: boolean }) {
  const settings = useAlertSettings();
  const update = useUpdateAlertSettings();
  const [draft, setDraft] = useState<AlertSettingsDraft | null>(null);

  useEffect(() => {
    if (settings.data) setDraft(AlertSettingsForm.toDraft(settings.data));
  }, [settings.data]);

  if (!settings.data || !draft) return null;

  const errors = AlertSettingsForm.validate(draft);
  const invalid = Object.keys(errors).length > 0;
  const dirty = AlertSettingsForm.isDirty(draft, settings.data);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <BellRing className="size-4" aria-hidden="true" />
          Resource alerts
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex items-start justify-between gap-6">
          <div className="space-y-1">
            <Label htmlFor="alerts-enabled">Send resource alerts</Label>
            <p className="text-muted-foreground max-w-2xl text-sm">
              Notify your channels when a service stays above these levels, or a server disk fills
              up. Individual services can be muted from their settings.
            </p>
          </div>
          <Switch
            id="alerts-enabled"
            checked={draft.enabled}
            disabled={!canManage}
            onCheckedChange={(enabled) => setDraft({ ...draft, enabled })}
          />
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {FIELDS.map((field) => (
            <div key={field.key} className="space-y-1.5">
              <Label htmlFor={`alert-${field.key}`}>{field.label}</Label>
              <div className="flex items-center gap-2">
                <Input
                  id={`alert-${field.key}`}
                  inputMode="numeric"
                  value={draft[field.key]}
                  disabled={!canManage || !draft.enabled}
                  aria-invalid={Boolean(errors[field.key])}
                  aria-describedby={errors[field.key] ? `alert-${field.key}-error` : undefined}
                  onChange={(event) => setDraft({ ...draft, [field.key]: event.target.value })}
                  className="w-20 font-mono"
                />
                <span className="text-muted-foreground text-sm">{field.unit}</span>
              </div>
              {errors[field.key] ? (
                <p id={`alert-${field.key}-error`} className="text-destructive text-xs">
                  {errors[field.key]}
                </p>
              ) : (
                <p className="text-muted-foreground text-xs">{field.hint}</p>
              )}
            </div>
          ))}
        </div>

        {canManage ? (
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              disabled={!dirty || invalid || update.isPending}
              onClick={() => update.mutate(AlertSettingsForm.toPayload(draft))}
            >
              {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Save alert settings
            </Button>
            {dirty ? (
              <Button variant="ghost" size="sm" onClick={() => setDraft(AlertSettingsForm.toDraft(settings.data))}>
                Reset
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="text-muted-foreground text-xs">
            Only organization owners and admins can change these settings.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
