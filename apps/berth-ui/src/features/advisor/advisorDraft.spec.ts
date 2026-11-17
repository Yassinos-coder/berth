import { describe, expect, it } from 'vitest';
import { AdvisorDraftRules } from '@/features/advisor/advisorDraft';

describe('AdvisorDraftRules', () => {
  it('starts on Anthropic with its locked URL and first model', () => {
    const draft = AdvisorDraftRules.initial();
    expect(draft.provider).toBe('anthropic');
    expect(draft.baseUrl).toBe('https://api.anthropic.com');
    expect(draft.model).toBe('claude-sonnet-5-5');
    expect(draft.monthlyCapUsd).toBe('5');
  });

  it('keeps the cap and enabled flag when the provider changes', () => {
    const draft = { ...AdvisorDraftRules.initial(), enabled: true, monthlyCapUsd: '12' };
    const next = AdvisorDraftRules.switchProvider(draft, 'openai');
    expect(next.provider).toBe('openai');
    expect(next.model).toBe('gpt-4.1');
    expect(next.monthlyCapUsd).toBe('12');
    expect(next.enabled).toBe(true);
  });

  it('requires a key only when enabled and none is saved', () => {
    const draft = { ...AdvisorDraftRules.initial(), enabled: true };
    expect(AdvisorDraftRules.error(AdvisorDraftRules.initial(), false)).toBeNull();
    expect(AdvisorDraftRules.error(draft, false)).toMatch(/API key/);
    expect(AdvisorDraftRules.error(draft, true)).toBeNull();
    expect(AdvisorDraftRules.error({ ...draft, enabled: false }, false)).toBeNull();
  });

  it('needs a URL and model for a custom provider and no key for Ollama', () => {
    const custom = { ...AdvisorDraftRules.forProvider('custom', true), apiKey: 'sk-1234567890' };
    expect(AdvisorDraftRules.error(custom, false)).toMatch(/URL/);
    expect(AdvisorDraftRules.error({ ...custom, baseUrl: 'https://llm.example.com/v1' }, false)).toMatch(/model/);
    expect(AdvisorDraftRules.error(AdvisorDraftRules.forProvider('ollama', true), false)).toBeNull();
  });

  it('rejects keys with spaces and caps out of range', () => {
    const draft = { ...AdvisorDraftRules.initial(), enabled: true };
    expect(AdvisorDraftRules.error({ ...draft, apiKey: 'abc def ghi jkl' }, false)).toMatch(/does not look right/);
    expect(AdvisorDraftRules.error({ ...draft, apiKey: 'sk-1234567890', monthlyCapUsd: '5000' }, false)).toMatch(/cap/);
  });

  it('sends the URL only for providers that allow editing it', () => {
    const anthropic = { ...AdvisorDraftRules.initial(), apiKey: ' sk-1234567890 ' };
    const payload = AdvisorDraftRules.toPayload(anthropic);
    expect(payload.baseUrl).toBeUndefined();
    expect(payload.apiKey).toBe('sk-1234567890');
    const custom = { ...AdvisorDraftRules.forProvider('custom', true), baseUrl: ' https://x.io/v1 ', model: 'm' };
    expect(AdvisorDraftRules.toPayload(custom).baseUrl).toBe('https://x.io/v1');
  });

  it('never carries the key back from saved settings', () => {
    const draft = AdvisorDraftRules.fromSettings({
      enabled: true, provider: 'anthropic', baseUrl: '', model: 'claude-haiku-5-5', hasKey: true,
      monthlyCapUsd: 3, spentUsd: 1, priceInPerMTok: 1, priceOutPerMTok: 5, periodStart: '2026-11-01T00:00:00.000Z',
    });
    expect(draft.apiKey).toBe('');
    expect(AdvisorDraftRules.toPayload(draft).apiKey).toBeUndefined();
  });
});
