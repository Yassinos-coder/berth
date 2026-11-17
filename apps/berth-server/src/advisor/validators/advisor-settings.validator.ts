import { AdvisorCatalog, DEFAULT_CUSTOM_PRICE_PER_MTOK } from '@berth/protocol';
import { ProviderUrlValidator } from './provider-url.validator';

export interface SettingsInput {
  enabled?: boolean;
  provider?: string;
  baseUrl?: string;
  model?: string;
  apiKey?: string;
  monthlyCapUsd?: number;
  priceInPerMTok?: number;
  priceOutPerMTok?: number;
}

export interface CurrentSettings {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  monthlyCapUsd: number;
  priceInPerMTok: number;
  priceOutPerMTok: number;
}

export interface SettingsUpdate {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  newApiKey?: string;
  monthlyCapUsd: number;
  priceInPerMTok: number;
  priceOutPerMTok: number;
}

const MODEL_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/@-]{0,119}$/;

export class AdvisorSettingsValidator {
  static validate(
    input: SettingsInput,
    current: CurrentSettings,
  ): { update?: SettingsUpdate; error?: string } {
    const providerId = input.provider ?? current.provider;
    const provider = AdvisorCatalog.provider(providerId);
    if (!provider) return { error: 'Choose a provider from the list.' };
    const switchedProvider = providerId !== current.provider;

    let baseUrl: string;
    if (provider.editableBaseUrl) {
      const candidate = input.baseUrl ?? (switchedProvider ? provider.baseUrl : current.baseUrl);
      const checked = ProviderUrlValidator.check(candidate || provider.baseUrl);
      if (!checked.ok) return { error: checked.error };
      baseUrl = checked.url!;
    } else {
      baseUrl = provider.baseUrl;
    }

    let model = (input.model ?? (switchedProvider ? '' : current.model)).trim();
    if (!model) model = provider.models[0]?.id ?? '';
    if (!model) return { error: 'Enter the model name.' };
    if (provider.models.length > 0 && !provider.allowCustomModel && !provider.models.some((m) => m.id === model)) {
      return { error: 'Choose one of the listed models.' };
    }
    if (!MODEL_PATTERN.test(model)) return { error: 'That model name is not valid.' };

    let newApiKey: string | undefined;
    if (input.apiKey !== undefined && input.apiKey !== '') {
      const key = input.apiKey.trim();
      if (key.length < 8 || key.length > 400 || /\s/.test(key)) {
        return { error: 'That API key does not look right. Paste it again without spaces.' };
      }
      newApiKey = key;
    }
    const enabled = input.enabled ?? current.enabled;
    const willHaveKey = Boolean(newApiKey) || (current.hasKey && !switchedProvider);
    if (enabled && provider.needsKey && !willHaveKey) {
      return { error: 'Add an API key to turn the advisor on.' };
    }

    const cap = input.monthlyCapUsd ?? current.monthlyCapUsd;
    if (!Number.isFinite(cap) || cap < 0 || cap > 1000) return { error: 'The monthly cap must be between $0 and $1000.' };

    const catalogModel = AdvisorCatalog.model(providerId, model);
    const defaults = catalogModel
      ? { input: catalogModel.inputPerMTok, output: catalogModel.outputPerMTok }
      : provider.id === 'ollama'
        ? { input: 0, output: 0 }
        : DEFAULT_CUSTOM_PRICE_PER_MTOK;
    const keepPrices = !switchedProvider && input.model === undefined;
    const priceIn = input.priceInPerMTok ?? (keepPrices && current.priceInPerMTok > 0 ? current.priceInPerMTok : defaults.input);
    const priceOut = input.priceOutPerMTok ?? (keepPrices && current.priceOutPerMTok > 0 ? current.priceOutPerMTok : defaults.output);

    return {
      update: {
        enabled,
        provider: providerId,
        baseUrl,
        model,
        ...(newApiKey ? { newApiKey } : {}),
        monthlyCapUsd: cap,
        priceInPerMTok: priceIn,
        priceOutPerMTok: priceOut,
      },
    };
  }
}
