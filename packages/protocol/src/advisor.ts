export type AdvisorWireFormat = 'anthropic' | 'openai';

export interface AdvisorModel {
  id: string;
  label: string;
  inputPerMTok: number;
  outputPerMTok: number;
}

export interface AdvisorProvider {
  id: string;
  name: string;
  wire: AdvisorWireFormat;
  baseUrl: string;
  editableBaseUrl: boolean;
  needsKey: boolean;
  allowCustomModel: boolean;
  models: AdvisorModel[];
}

const model = (id: string, label: string, inputPerMTok: number, outputPerMTok: number): AdvisorModel => ({
  id,
  label,
  inputPerMTok,
  outputPerMTok,
});

/**
 * Prices are list-price estimates in USD per million tokens. They are used only
 * to stop spending at the user's cap, and can be overridden in settings.
 */
export const ADVISOR_PROVIDERS: AdvisorProvider[] = [
  {
    id: 'anthropic',
    name: 'Anthropic',
    wire: 'anthropic',
    baseUrl: 'https://api.anthropic.com',
    editableBaseUrl: false,
    needsKey: true,
    allowCustomModel: false,
    models: [
      model('claude-sonnet-5-5', 'Claude Sonnet 5.5', 3, 15),
      model('claude-haiku-5-5', 'Claude Haiku 5.5', 1, 5),
      model('claude-opus-5-5', 'Claude Opus 5.5', 15, 75),
    ],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    wire: 'openai',
    baseUrl: 'https://api.openai.com/v1',
    editableBaseUrl: false,
    needsKey: true,
    allowCustomModel: false,
    models: [
      model('gpt-4.1', 'GPT-4.1', 2, 8),
      model('gpt-4.1-mini', 'GPT-4.1 mini', 0.4, 1.6),
      model('gpt-4o', 'GPT-4o', 2.5, 10),
      model('gpt-4o-mini', 'GPT-4o mini', 0.15, 0.6),
    ],
  },
  {
    id: 'google',
    name: 'Google Gemini',
    wire: 'openai',
    baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
    editableBaseUrl: false,
    needsKey: true,
    allowCustomModel: false,
    models: [
      model('gemini-2.5-pro', 'Gemini 2.5 Pro', 1.25, 10),
      model('gemini-2.5-flash', 'Gemini 2.5 Flash', 0.3, 2.5),
    ],
  },
  {
    id: 'mistral',
    name: 'Mistral',
    wire: 'openai',
    baseUrl: 'https://api.mistral.ai/v1',
    editableBaseUrl: false,
    needsKey: true,
    allowCustomModel: false,
    models: [
      model('mistral-large-latest', 'Mistral Large', 2, 6),
      model('mistral-small-latest', 'Mistral Small', 0.2, 0.6),
    ],
  },
  {
    id: 'deepseek',
    name: 'DeepSeek',
    wire: 'openai',
    baseUrl: 'https://api.deepseek.com/v1',
    editableBaseUrl: false,
    needsKey: true,
    allowCustomModel: false,
    models: [model('deepseek-chat', 'DeepSeek Chat', 0.27, 1.1), model('deepseek-reasoner', 'DeepSeek Reasoner', 0.55, 2.19)],
  },
  {
    id: 'groq',
    name: 'Groq',
    wire: 'openai',
    baseUrl: 'https://api.groq.com/openai/v1',
    editableBaseUrl: false,
    needsKey: true,
    allowCustomModel: true,
    models: [model('llama-3.3-70b-versatile', 'Llama 3.3 70B', 0.59, 0.79)],
  },
  {
    id: 'xai',
    name: 'xAI',
    wire: 'openai',
    baseUrl: 'https://api.x.ai/v1',
    editableBaseUrl: false,
    needsKey: true,
    allowCustomModel: true,
    models: [model('grok-3', 'Grok 3', 3, 15)],
  },
  {
    id: 'openrouter',
    name: 'OpenRouter',
    wire: 'openai',
    baseUrl: 'https://openrouter.ai/api/v1',
    editableBaseUrl: false,
    needsKey: true,
    allowCustomModel: true,
    models: [model('anthropic/claude-sonnet-5-5', 'Claude Sonnet 5.5 via OpenRouter', 3, 15)],
  },
  {
    id: 'ollama',
    name: 'Ollama (local)',
    wire: 'openai',
    baseUrl: 'http://localhost:11434/v1',
    editableBaseUrl: true,
    needsKey: false,
    allowCustomModel: true,
    models: [model('llama3.1', 'Llama 3.1', 0, 0)],
  },
  {
    id: 'custom',
    name: 'Custom (OpenAI-compatible)',
    wire: 'openai',
    baseUrl: '',
    editableBaseUrl: true,
    needsKey: true,
    allowCustomModel: true,
    models: [],
  },
];

export const DEFAULT_CUSTOM_PRICE_PER_MTOK = { input: 5, output: 15 };

export class AdvisorCatalog {
  static provider(id: string): AdvisorProvider | undefined {
    return ADVISOR_PROVIDERS.find((provider) => provider.id === id);
  }

  static model(providerId: string, modelId: string): AdvisorModel | undefined {
    return AdvisorCatalog.provider(providerId)?.models.find((item) => item.id === modelId);
  }
}

export type AdvisorSeverity = 'info' | 'warning' | 'critical';
export type AdvisorFindingStatus = 'open' | 'applied' | 'dismissed' | 'superseded';
export type AdvisorFindingSource = 'rules' | 'ai';
export type AdvisorFindingKind =
  | 'resources'
  | 'storage'
  | 'reliability'
  | 'security'
  | 'cost'
  | 'config';

export type AdvisorAction =
  | { type: 'set-resources'; serviceId: string; cpuCores?: number; memoryMb?: number }
  | { type: 'set-disk-size'; serviceId: string; diskGb: number }
  | { type: 'enable-auto-rollback'; serviceId: string };

export interface AdvisorFindingDto {
  id: string;
  kind: AdvisorFindingKind;
  severity: AdvisorSeverity;
  source: AdvisorFindingSource;
  status: AdvisorFindingStatus;
  title: string;
  detail: string;
  evidence: string[];
  serviceId?: string;
  serviceName?: string;
  action?: AdvisorAction;
  actionLabel?: string;
  createdAt: string;
  resolvedAt?: string;
  canUndo: boolean;
}

export interface AdvisorSettingsDto {
  enabled: boolean;
  provider: string;
  baseUrl: string;
  model: string;
  hasKey: boolean;
  monthlyCapUsd: number;
  spentUsd: number;
  priceInPerMTok: number;
  priceOutPerMTok: number;
  periodStart: string;
  lastRunAt?: string;
  lastError?: string;
}

export interface AdvisorSummaryDto {
  enabled: boolean;
  openCount: number;
  criticalCount: number;
  spentUsd: number;
  capUsd: number;
  lastRunAt?: string;
}
