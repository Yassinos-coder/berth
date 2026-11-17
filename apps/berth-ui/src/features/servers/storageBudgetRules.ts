import { StorageMath } from '@berth/protocol';

export class StorageBudgetRules {
  static minimumBudgetGb(allocatedGb: number): number {
    let budget = Math.max(5, allocatedGb);
    while (StorageMath.allocatableGb(budget) < allocatedGb) budget += 1;
    return budget;
  }

  static maximumBudgetGb(hostTotalGb: number | null): number {
    return hostTotalGb && hostTotalGb > 0 ? hostTotalGb : 65536;
  }
}
