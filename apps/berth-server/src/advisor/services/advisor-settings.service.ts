import { BadRequestException, Injectable } from '@nestjs/common';
import { AdvisorCatalog, type AdvisorSettingsDto } from '@berth/protocol';
import { SecretCipher } from '../../common/crypto/secret-cipher.service';
import { AdvisorRepository } from '../repositories/advisor.repository';
import { FindingMapper } from '../mappers/finding.mapper';
import { AdvisorBudget } from '../analysis/advisor-budget.util';
import { AdvisorSettingsValidator, type CurrentSettings } from '../validators/advisor-settings.validator';
import type { UpdateAdvisorSettingsDto } from '../dto/update-advisor-settings.dto';
import type { AdvisorSettings } from '@prisma/client';

export interface ResolvedProvider {
  wire: 'anthropic' | 'openai';
  baseUrl: string;
  apiKey?: string;
  model: string;
  priceIn: number;
  priceOut: number;
}

@Injectable()
export class AdvisorSettingsService {
  constructor(
    private readonly repository: AdvisorRepository,
    private readonly cipher: SecretCipher,
  ) {}

  async get(orgId: string): Promise<AdvisorSettingsDto> {
    const settings = await this.ensure(orgId);
    return FindingMapper.settingsDto(settings);
  }

  async update(orgId: string, dto: UpdateAdvisorSettingsDto): Promise<AdvisorSettingsDto> {
    const existing = await this.ensure(orgId);
    const current: CurrentSettings = {
      enabled: existing.enabled,
      provider: existing.provider,
      baseUrl: existing.baseUrl,
      model: existing.model,
      hasKey: Boolean(existing.apiKeyEncrypted),
      monthlyCapUsd: existing.monthlyCapUsd,
      priceInPerMTok: existing.priceInPerMTok,
      priceOutPerMTok: existing.priceOutPerMTok,
    };
    const { update, error } = AdvisorSettingsValidator.validate(dto, current);
    if (!update) throw new BadRequestException(error);

    const switched = update.provider !== existing.provider;
    const saved = await this.repository.upsertSettings(orgId, {
      enabled: update.enabled,
      provider: update.provider,
      baseUrl: update.baseUrl,
      model: update.model,
      monthlyCapUsd: update.monthlyCapUsd,
      priceInPerMTok: update.priceInPerMTok,
      priceOutPerMTok: update.priceOutPerMTok,
      ...(update.newApiKey
        ? { apiKeyEncrypted: this.cipher.encrypt(update.newApiKey) }
        : switched
          ? { apiKeyEncrypted: null }
          : {}),
      lastError: null,
    });
    return FindingMapper.settingsDto(saved);
  }

  async resetPeriodIfNeeded(settings: AdvisorSettings, now: Date): Promise<AdvisorSettings> {
    if (!AdvisorBudget.periodExpired(settings.periodStart, now)) return settings;
    return this.repository.upsertSettings(settings.orgId, { spentUsd: 0, periodStart: now });
  }

  resolve(settings: AdvisorSettings): ResolvedProvider | null {
    const provider = AdvisorCatalog.provider(settings.provider);
    if (!provider || !settings.model) return null;
    if (provider.needsKey && !settings.apiKeyEncrypted) return null;
    return {
      wire: provider.wire,
      baseUrl: settings.baseUrl || provider.baseUrl,
      apiKey: settings.apiKeyEncrypted ? this.cipher.decrypt(settings.apiKeyEncrypted) : undefined,
      model: settings.model,
      priceIn: settings.priceInPerMTok,
      priceOut: settings.priceOutPerMTok,
    };
  }

  async ensure(orgId: string): Promise<AdvisorSettings> {
    const existing = await this.repository.getSettings(orgId);
    if (existing) return existing;
    const provider = AdvisorCatalog.provider('anthropic')!;
    const model = provider.models[0];
    return this.repository.upsertSettings(orgId, {
      provider: provider.id,
      baseUrl: provider.baseUrl,
      model: model.id,
      priceInPerMTok: model.inputPerMTok,
      priceOutPerMTok: model.outputPerMTok,
    });
  }
}
