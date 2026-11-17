const CHARS_PER_TOKEN = 3.5;

export class AdvisorBudget {
  static costUsd(tokensIn: number, tokensOut: number, priceInPerMTok: number, priceOutPerMTok: number): number {
    return (tokensIn * priceInPerMTok + tokensOut * priceOutPerMTok) / 1_000_000;
  }

  static estimateTokens(text: string): number {
    return Math.ceil(text.length / CHARS_PER_TOKEN);
  }

  static worstCaseUsd(inputTokens: number, maxOutputTokens: number, priceIn: number, priceOut: number): number {
    return AdvisorBudget.costUsd(inputTokens, maxOutputTokens, priceIn, priceOut);
  }

  static canSpend(spentUsd: number, capUsd: number, reserveUsd: number): boolean {
    if (capUsd <= 0) return false;
    return spentUsd + reserveUsd <= capUsd + 1e-9;
  }

  static periodExpired(periodStart: Date, now: Date): boolean {
    return (
      periodStart.getUTCFullYear() !== now.getUTCFullYear() ||
      periodStart.getUTCMonth() !== now.getUTCMonth()
    );
  }

  static remainingUsd(spentUsd: number, capUsd: number): number {
    return Math.max(0, capUsd - spentUsd);
  }
}
