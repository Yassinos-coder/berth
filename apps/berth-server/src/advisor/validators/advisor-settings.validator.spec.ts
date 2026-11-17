import { describe, expect, it } from 'vitest';
import { AdvisorSettingsValidator as V, type CurrentSettings } from './advisor-settings.validator';

const current: CurrentSettings = {
  enabled: false,
  provider: 'anthropic',
  baseUrl: 'https://api.anthropic.com',
  model: 'claude-sonnet-5-5',
  hasKey: false,
  monthlyCapUsd: 5,
  priceInPerMTok: 0,
  priceOutPerMTok: 0,
};
const KEY = 'sk-ant-api03-abcdefghijklmnop';

describe('AdvisorSettingsValidator', () => {
  it('turns on a known provider with a key and fills in the model price', () => {
    const { update, error } = V.validate({ enabled: true, apiKey: KEY }, current);
    expect(error).toBeUndefined();
    expect(update).toMatchObject({ enabled: true, provider: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-5-5', newApiKey: KEY, monthlyCapUsd: 5, priceInPerMTok: 3, priceOutPerMTok: 15 });
  });

  it('locks the URL of a known provider, whatever the client sends', () => {
    const { update } = V.validate({ enabled: true, apiKey: KEY, baseUrl: 'https://evil.example.com' }, current);
    expect(update?.baseUrl).toBe('https://api.anthropic.com');
  });

  it('will not enable without a key for a provider that needs one', () => {
    expect(V.validate({ enabled: true }, current).error).toContain('API key');
  });

  it('keeps a stored key when only other settings change', () => {
    const { update } = V.validate({ monthlyCapUsd: 10 }, { ...current, hasKey: true, enabled: true });
    expect(update?.newApiKey).toBeUndefined();
    expect(update?.monthlyCapUsd).toBe(10);
  });

  it('requires a new key when switching to a different provider', () => {
    expect(V.validate({ provider: 'openai', enabled: true }, { ...current, hasKey: true, enabled: true }).error).toContain('API key');
  });

  it('only accepts listed models for a fixed provider, but any name for custom ones', () => {
    expect(V.validate({ model: 'gpt-9000', apiKey: KEY }, current).error).toContain('listed models');
    const custom = V.validate({ provider: 'custom', baseUrl: 'https://llm.example.com/v1', model: 'my-model:7b', apiKey: KEY, enabled: true }, current);
    expect(custom.update).toMatchObject({ provider: 'custom', baseUrl: 'https://llm.example.com/v1', model: 'my-model:7b', priceInPerMTok: 5, priceOutPerMTok: 15 });
  });

  it('validates the URL of an editable provider', () => {
    expect(V.validate({ provider: 'custom', baseUrl: 'http://api.example.com', model: 'm', apiKey: KEY }, current).error).toContain('https://');
    expect(V.validate({ provider: 'custom', baseUrl: 'https://169.254.169.254', model: 'm', apiKey: KEY }, current).error).toContain('not allowed');
    expect(V.validate({ provider: 'custom', baseUrl: '', model: 'm', apiKey: KEY }, current).error).toBeTruthy();
  });

  it('lets a local model run with no key and no cost', () => {
    const { update, error } = V.validate({ provider: 'ollama', enabled: true, model: 'llama3.1' }, current);
    expect(error).toBeUndefined();
    expect(update).toMatchObject({ baseUrl: 'http://localhost:11434/v1', priceInPerMTok: 0, priceOutPerMTok: 0 });
  });

  it('rejects an unknown provider, a bad key and a bad cap', () => {
    expect(V.validate({ provider: 'nope' }, current).error).toContain('provider');
    expect(V.validate({ apiKey: 'short' }, current).error).toContain('API key');
    expect(V.validate({ apiKey: 'has space inside key 123' }, current).error).toContain('API key');
    expect(V.validate({ monthlyCapUsd: -1, apiKey: KEY }, current).error).toContain('cap');
    expect(V.validate({ monthlyCapUsd: 5000, apiKey: KEY }, current).error).toContain('cap');
  });

  it('keeps user-set prices unless the model changes', () => {
    const tuned = { ...current, hasKey: true, priceInPerMTok: 9, priceOutPerMTok: 19 };
    expect(V.validate({ monthlyCapUsd: 8 }, tuned).update).toMatchObject({ priceInPerMTok: 9, priceOutPerMTok: 19 });
    expect(V.validate({ model: 'claude-haiku-5-5' }, tuned).update).toMatchObject({ priceInPerMTok: 1, priceOutPerMTok: 5 });
    expect(V.validate({ priceInPerMTok: 4 }, tuned).update).toMatchObject({ priceInPerMTok: 4, priceOutPerMTok: 19 });
  });
});
