import { StorageMath } from '@berth/protocol';

export const MIN_VOLUME_GB = 1;
export const MAX_VOLUME_GB = 2048;

export interface StorageSummary {
  budgetGb: number | null;
  reservedGb: number;
  allocatedGb: number;
  allocatableGb: number | null;
  freeGb: number | null;
}

export class StorageBudgetValidator {
  static reserveGb(budgetGb: number): number {
    return StorageMath.reserveGb(budgetGb);
  }

  static allocatableGb(budgetGb: number): number {
    return StorageMath.allocatableGb(budgetGb);
  }

  static summarize(budgetGb: number | null, allocatedGb: number): StorageSummary {
    if (budgetGb === null) {
      return { budgetGb: null, reservedGb: 0, allocatedGb, allocatableGb: null, freeGb: null };
    }
    const allocatableGb = StorageBudgetValidator.allocatableGb(budgetGb);
    return {
      budgetGb,
      reservedGb: StorageBudgetValidator.reserveGb(budgetGb),
      allocatedGb,
      allocatableGb,
      freeGb: Math.max(0, allocatableGb - allocatedGb),
    };
  }

  static sizeError(sizeGb: number): string | null {
    if (!Number.isInteger(sizeGb)) return 'Storage size must be a whole number of GB.';
    if (sizeGb < MIN_VOLUME_GB) return `Storage must be at least ${MIN_VOLUME_GB} GB.`;
    if (sizeGb > MAX_VOLUME_GB) return `Storage cannot exceed ${MAX_VOLUME_GB} GB.`;
    return null;
  }

  static shortfall(
    budgetGb: number | null,
    allocatedOtherGb: number,
    requestedGb: number,
    serverName: string,
  ): string | null {
    if (budgetGb === null) return null;
    const summary = StorageBudgetValidator.summarize(budgetGb, allocatedOtherGb);
    if (requestedGb <= (summary.freeGb ?? 0)) return null;
    return (
      `${requestedGb} GB does not fit on ${serverName}: ${summary.freeGb} GB of ` +
      `its ${summary.allocatableGb} GB service storage is free (the ${budgetGb} GB Berth ` +
      `budget keeps ${summary.reservedGb} GB for images, build cache and logs).`
    );
  }

  static budgetError(
    budgetGb: number,
    allocatedGb: number,
    hostTotalGb: number | null,
  ): string | null {
    if (!Number.isInteger(budgetGb) || budgetGb < 5) {
      return 'The Berth storage budget must be at least 5 GB.';
    }
    if (hostTotalGb !== null && hostTotalGb > 0 && budgetGb > hostTotalGb) {
      return `The server only has ${hostTotalGb} GB of disk, so the budget cannot be ${budgetGb} GB.`;
    }
    const allocatable = StorageBudgetValidator.allocatableGb(budgetGb);
    if (allocatedGb > allocatable) {
      const needed = allocatedGb + StorageBudgetValidator.reserveGb(allocatedGb + 1);
      return (
        `Services already use ${allocatedGb} GB. A ${budgetGb} GB budget leaves only ` +
        `${allocatable} GB for services; choose about ${needed} GB or more, or shrink a service first.`
      );
    }
    return null;
  }
}
