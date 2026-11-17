import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ADVISOR_MANUAL_COOLDOWN_MS, ADVISOR_MAX_OUTPUT_TOKENS, ADVISOR_REQUEST_TIMEOUT_MS } from '../constants/advisor.constants';
import { AdvisorRepository } from '../repositories/advisor.repository';
import { AdvisorBudget } from '../analysis/advisor-budget.util';
import { AdvisorOutputParser } from '../analysis/advisor-output.parser';
import { ADVISOR_SYSTEM_PROMPT, PromptBuilder } from '../analysis/prompt.builder';
import { RuleEngine } from '../analysis/rule-engine';
import { SnapshotBuilder } from '../analysis/snapshot.builder';
import { AdvisorProviderClient, AdvisorProviderError } from './advisor-provider.client';
import { AdvisorSettingsService } from './advisor-settings.service';

export interface AnalysisOutcome {
  ran: boolean;
  reason?: string;
  usedAi: boolean;
  findings: number;
  costUsd: number;
  notice?: string;
}

@Injectable()
export class AdvisorAnalysisService {
  private readonly logger = new Logger(AdvisorAnalysisService.name);
  private readonly running = new Set<string>();

  constructor(
    private readonly repository: AdvisorRepository,
    private readonly settingsService: AdvisorSettingsService,
    private readonly client: AdvisorProviderClient,
  ) {}

  async run(orgId: string, options: { manual: boolean }): Promise<AnalysisOutcome> {
    const now = new Date();
    let settings = await this.settingsService.ensure(orgId);
    if (!settings.enabled) return { ran: false, reason: 'The advisor is turned off.', usedAi: false, findings: 0, costUsd: 0 };

    if (options.manual && settings.lastRunAt && now.getTime() - settings.lastRunAt.getTime() < ADVISOR_MANUAL_COOLDOWN_MS) {
      throw new BadRequestException('The advisor just ran. Give it a few minutes before asking again.');
    }
    if (this.running.has(orgId)) {
      throw new BadRequestException('An analysis is already running.');
    }
    this.running.add(orgId);

    const run = await this.repository.startRun(orgId);
    try {
      settings = await this.settingsService.resetPeriodIfNeeded(settings, now);
      const raw = await this.repository.collect(orgId, now);
      const snapshot = SnapshotBuilder.build(raw);
      const candidates = RuleEngine.evaluate(snapshot);

      let merged = candidates;
      let usedAi = false;
      let tokensIn = 0;
      let tokensOut = 0;
      let costUsd = 0;
      let notice: string | undefined;

      const provider = this.settingsService.resolve(settings);
      if (!provider) {
        notice = 'No API key is set, so only built-in checks ran.';
      } else {
        const user = PromptBuilder.user(snapshot, candidates);
        const inputEstimate = AdvisorBudget.estimateTokens(ADVISOR_SYSTEM_PROMPT) + AdvisorBudget.estimateTokens(user);
        const reserve = AdvisorBudget.worstCaseUsd(inputEstimate, ADVISOR_MAX_OUTPUT_TOKENS, provider.priceIn, provider.priceOut);

        if (!AdvisorBudget.canSpend(settings.spentUsd, settings.monthlyCapUsd, reserve)) {
          notice = `The monthly spending cap of $${settings.monthlyCapUsd} would be exceeded, so only built-in checks ran.`;
        } else {
          try {
            const result = await this.client.complete({
              wire: provider.wire,
              baseUrl: provider.baseUrl,
              apiKey: provider.apiKey,
              model: provider.model,
              system: ADVISOR_SYSTEM_PROMPT,
              user,
              maxTokens: ADVISOR_MAX_OUTPUT_TOKENS,
              timeoutMs: ADVISOR_REQUEST_TIMEOUT_MS,
            });
            tokensIn = result.tokensIn || inputEstimate;
            tokensOut = result.tokensOut;
            costUsd = AdvisorBudget.costUsd(tokensIn, tokensOut, provider.priceIn, provider.priceOut);
            merged = AdvisorOutputParser.merge(result.text, candidates, new Set(snapshot.services.map((s) => s.id))).findings;
            usedAi = true;
          } catch (error) {
            notice = error instanceof AdvisorProviderError ? error.message : 'The AI provider failed.';
            this.logger.warn(`advisor provider failed for org ${orgId}: ${notice}`);
          }
        }
      }

      const saved = await this.repository.saveCandidates(orgId, merged, usedAi ? ['rules', 'ai'] : ['rules']);
      await this.repository.addSpend(orgId, costUsd, now);
      await this.repository.upsertSettings(orgId, { lastError: notice ?? null });
      await this.repository.finishRun(run.id, { usedAi, tokensIn, tokensOut, costUsd, findings: saved, error: notice });
      return { ran: true, usedAi, findings: saved, costUsd, notice };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Analysis failed';
      await this.repository.finishRun(run.id, { usedAi: false, tokensIn: 0, tokensOut: 0, costUsd: 0, findings: 0, error: message });
      throw error;
    } finally {
      this.running.delete(orgId);
    }
  }

  async testConnection(orgId: string): Promise<{ ok: boolean; message: string; costUsd: number }> {
    const now = new Date();
    const settings = await this.settingsService.resetPeriodIfNeeded(await this.settingsService.ensure(orgId), now);
    const provider = this.settingsService.resolve(settings);
    if (!provider) return { ok: false, message: 'Add an API key first.', costUsd: 0 };

    const reserve = AdvisorBudget.worstCaseUsd(60, 16, provider.priceIn, provider.priceOut);
    if (!AdvisorBudget.canSpend(settings.spentUsd, settings.monthlyCapUsd, reserve)) {
      return { ok: false, message: 'The monthly cap is reached.', costUsd: 0 };
    }
    try {
      const result = await this.client.complete({
        wire: provider.wire,
        baseUrl: provider.baseUrl,
        apiKey: provider.apiKey,
        model: provider.model,
        system: 'Reply with the single word ok.',
        user: 'ping',
        maxTokens: 16,
        timeoutMs: 20_000,
      });
      const costUsd = AdvisorBudget.costUsd(result.tokensIn, result.tokensOut, provider.priceIn, provider.priceOut);
      await this.repository.upsertSettings(orgId, { spentUsd: { increment: costUsd } });
      return { ok: true, message: 'Connected.', costUsd };
    } catch (error) {
      return { ok: false, message: error instanceof AdvisorProviderError ? error.message : 'The connection failed.', costUsd: 0 };
    }
  }
}
