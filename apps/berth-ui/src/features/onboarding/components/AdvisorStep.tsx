import { AdvisorSettingsFields } from '@/features/advisor/AdvisorSettingsFields';
import type { AdvisorDraft } from '@/features/advisor/advisorDraft';

export function AdvisorStep({
  draft,
  onChange,
  error,
}: {
  draft: AdvisorDraft;
  onChange: (draft: AdvisorDraft) => void;
  error: string | null;
}) {
  return (
    <div className="space-y-4">
      <AdvisorSettingsFields draft={draft} onChange={onChange} hasKey={false} idPrefix="onboarding-advisor" />
      {error ? <p className="text-destructive text-xs">{error}</p> : null}
      <p className="text-muted-foreground text-xs">
        You can skip this and turn it on later in Settings. The final button creates your account
        either way.
      </p>
    </div>
  );
}
