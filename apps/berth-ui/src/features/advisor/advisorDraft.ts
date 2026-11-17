import {
  AdvisorCatalog,
  DEFAULT_CUSTOM_PRICE_PER_MTOK,
  type AdvisorProvider,
  type AdvisorSettingsDto,
} from '@berth/protocol';
import type { AdvisorSettingsPayload } from '@/services/advisorService';

export interface AdvisorDraft {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  apiKey: string;
  monthlyCapUsd: string;
}

export class AdvisorDraftRules {
  static initial(): AdvisorDraft {
    return AdvisorDraftRules.forProvider('anthropic', false);
  }

  static fromSettings(settings: AdvisorSettingsDto): AdvisorDraft {
    return {
      enabled: settings.enabled,
      provider: settings.provider,
      baseUrl: settings.baseUrl,
      model: settings.model,
      apiKey: '',
      monthlyCapUsd: String(settings.monthlyCapUsd),
    };
  }

  static forProvider(id: string, enabled = false): AdvisorDraft {
    const provider = AdvisorCatalog.provider(id) ?? AdvisorCatalog.provider('anthropic')!;
    return {
      enabled,
      provider: provider.id,
      baseUrl: provider.baseUrl,
      model: provider.models[0]?.id ?? '',
      apiKey: '',
      monthlyCapUsd: '5',
    };
  }

  static switchProvider(draft: AdvisorDraft, id: string): AdvisorDraft {
    return { ...AdvisorDraftRules.forProvider(id, draft.enabled), monthlyCapUsd: draft.monthlyCapUsd };
  }

  static provider(draft: AdvisorDraft): AdvisorProvider {
    return AdvisorCatalog.provider(draft.provider) ?? AdvisorCatalog.provider('anthropic')!;
  }

  static error(draft: AdvisorDraft, hasKey: boolean): string | null {
    if (!draft.enabled) return null;
    const provider = AdvisorDraftRules.provider(draft);
    if (provider.editableBaseUrl && !draft.baseUrl.trim()) return 'Enter the API URL.';
    if (!draft.model.trim()) return 'Enter the model name.';
    const key = draft.apiKey.trim();
    if (provider.needsKey && !key && !hasKey) return 'Paste an API key.';
    if (key && (key.length < 8 || /\s/.test(key))) return 'That API key does not look right.';
    const cap = Number(draft.monthlyCapUsd);
    if (!Number.isFinite(cap) || cap < 0 || cap > 1000) return 'The monthly cap must be between $0 and $1000.';
    return null;
  }

  static toPayload(draft: AdvisorDraft): AdvisorSettingsPayload {
    const provider = AdvisorDraftRules.provider(draft);
    const key = draft.apiKey.trim();
    return {
      enabled: draft.enabled,
      provider: draft.provider,
      ...(provider.editableBaseUrl ? { baseUrl: draft.baseUrl.trim() } : {}),
      model: draft.model.trim(),
      ...(key ? { apiKey: key } : {}),
      monthlyCapUsd: Number(draft.monthlyCapUsd),
    };
  }

  static priceHint(draft: AdvisorDraft): string {
    const catalog = AdvisorCatalog.model(draft.provider, draft.model);
    if (catalog) return `About $${catalog.inputPerMTok} in / $${catalog.outputPerMTok} out per million tokens.`;
    if (draft.provider === 'ollama') return 'Local models are free.';
    return `Unknown model: assuming $${DEFAULT_CUSTOM_PRICE_PER_MTOK.input} in / $${DEFAULT_CUSTOM_PRICE_PER_MTOK.output} out per million tokens.`;
  }
}
