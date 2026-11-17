import { useEffect, useState } from 'react';
import { Loader2, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { AdvisorSettingsFields } from '@/features/advisor/AdvisorSettingsFields';
import { AdvisorDraftRules, type AdvisorDraft } from '@/features/advisor/advisorDraft';
import {
  useAdvisorSettings,
  useTestAdvisor,
  useUpdateAdvisorSettings,
} from '@/hooks/useAdvisor';

export function AdvisorSettingsCard({ canManage }: { canManage: boolean }) {
  const settings = useAdvisorSettings();
  const update = useUpdateAdvisorSettings();
  const test = useTestAdvisor();
  const [draft, setDraft] = useState<AdvisorDraft | null>(null);

  useEffect(() => {
    if (settings.data) setDraft(AdvisorDraftRules.fromSettings(settings.data));
  }, [settings.data]);

  if (!settings.data || !draft) return null;

  const error = AdvisorDraftRules.error(draft, settings.data.hasKey);

  const save = () => {
    update.mutate(AdvisorDraftRules.toPayload(draft), {
      onSuccess: () => setDraft((current) => (current ? { ...current, apiKey: '' } : current)),
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="size-4" aria-hidden="true" />
          AI advisor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <fieldset disabled={!canManage} className="space-y-4">
          <AdvisorSettingsFields
            draft={draft}
            onChange={setDraft}
            hasKey={settings.data.hasKey}
            idPrefix="advisor"
          />
        </fieldset>

        {settings.data.lastError ? (
          <p className="text-destructive text-xs" role="status">
            {settings.data.lastError}
          </p>
        ) : null}
        {test.data ? (
          <p
            className={test.data.ok ? 'text-xs text-emerald-600' : 'text-destructive text-xs'}
            role="status"
          >
            {test.data.message}
          </p>
        ) : null}
        {error ? <p className="text-destructive text-xs">{error}</p> : null}

        {canManage ? (
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={Boolean(error) || update.isPending}>
              {update.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
              Save
            </Button>
            {settings.data.enabled && settings.data.hasKey ? (
              <Button variant="outline" onClick={() => test.mutate()} disabled={test.isPending}>
                {test.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : null}
                Test connection
              </Button>
            ) : null}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
