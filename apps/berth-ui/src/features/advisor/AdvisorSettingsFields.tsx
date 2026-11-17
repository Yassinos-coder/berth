import { ShieldCheck } from 'lucide-react';
import { ADVISOR_PROVIDERS } from '@berth/protocol';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { AdvisorDraftRules, type AdvisorDraft } from '@/features/advisor/advisorDraft';

export function AdvisorSettingsFields({
  draft,
  onChange,
  hasKey,
  idPrefix,
}: {
  draft: AdvisorDraft;
  onChange: (draft: AdvisorDraft) => void;
  hasKey: boolean;
  idPrefix: string;
}) {
  const provider = AdvisorDraftRules.provider(draft);
  const listedModel = provider.models.some((model) => model.id === draft.model);
  const set = (patch: Partial<AdvisorDraft>) => onChange({ ...draft, ...patch });

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-6">
        <div className="space-y-1">
          <Label htmlFor={`${idPrefix}-enabled`}>Enable the AI advisor</Label>
          <p className="text-muted-foreground max-w-xl text-sm">
            Reviews your services and servers and suggests safe improvements, such as right-sizing
            memory. You decide whether to apply each one.
          </p>
        </div>
        <Switch
          id={`${idPrefix}-enabled`}
          checked={draft.enabled}
          onCheckedChange={(enabled) => set({ enabled })}
        />
      </div>

      {draft.enabled ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-provider`}>Provider</Label>
              <Select
                value={draft.provider}
                onValueChange={(id) => onChange(AdvisorDraftRules.switchProvider(draft, id))}
              >
                <SelectTrigger id={`${idPrefix}-provider`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ADVISOR_PROVIDERS.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-model`}>Model</Label>
              {provider.allowCustomModel || provider.models.length === 0 ? (
                <Input
                  id={`${idPrefix}-model`}
                  value={draft.model}
                  onChange={(event) => set({ model: event.target.value })}
                  placeholder="model-name"
                  autoComplete="off"
                  spellCheck={false}
                  className="font-mono"
                />
              ) : (
                <Select value={listedModel ? draft.model : undefined} onValueChange={(model) => set({ model })}>
                  <SelectTrigger id={`${idPrefix}-model`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {provider.models.map((model) => (
                      <SelectItem key={model.id} value={model.id}>
                        {model.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <p className="text-muted-foreground text-xs">{AdvisorDraftRules.priceHint(draft)}</p>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-url`}>API URL</Label>
            <Input
              id={`${idPrefix}-url`}
              value={provider.editableBaseUrl ? draft.baseUrl : provider.baseUrl}
              onChange={(event) => set({ baseUrl: event.target.value })}
              readOnly={!provider.editableBaseUrl}
              disabled={!provider.editableBaseUrl}
              placeholder="https://api.example.com/v1"
              autoComplete="off"
              spellCheck={false}
              className="font-mono"
            />
            {!provider.editableBaseUrl ? (
              <p className="text-muted-foreground text-xs">Fixed for {provider.name}.</p>
            ) : null}
          </div>

          {provider.needsKey ? (
            <div className="space-y-2">
              <Label htmlFor={`${idPrefix}-key`}>API key</Label>
              <Input
                id={`${idPrefix}-key`}
                type="password"
                value={draft.apiKey}
                onChange={(event) => set({ apiKey: event.target.value })}
                placeholder={hasKey ? 'Saved. Paste a new key to replace it' : 'Paste your API key'}
                autoComplete="off"
                spellCheck={false}
                className="font-mono"
              />
              <p className="text-muted-foreground flex items-start gap-1.5 text-xs">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
                Stored encrypted on your server and never shown again.
              </p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={`${idPrefix}-cap`}>Monthly spending cap (USD)</Label>
            <Input
              id={`${idPrefix}-cap`}
              type="number"
              min={0}
              max={1000}
              step={1}
              value={draft.monthlyCapUsd}
              onChange={(event) => set({ monthlyCapUsd: event.target.value })}
              className="w-32 font-mono"
            />
            <p className="text-muted-foreground text-xs">
              Berth stops calling the provider before this is exceeded. Built-in checks keep working.
            </p>
          </div>

          <p className="bg-muted/50 rounded-md px-3 py-2 text-xs">
            The advisor reads service names, sizes, usage peaks, deploy outcomes and server capacity.
            It never reads environment variables, secrets, tokens, repository URLs or logs.
          </p>
        </div>
      ) : null}
    </div>
  );
}
