import type { DeployStrategy } from '@berth/protocol';

interface DeployStrategyInput {
  strategy: DeployStrategy;
  replicas: number;
  autoscaled: boolean;
}

export class DeployStrategyValidator {
  static isAutoscaled(policy?: { strategy?: string } | null): boolean {
    return Boolean(policy?.strategy) && policy?.strategy !== 'manual';
  }

  static conflict(input: DeployStrategyInput): string | null {
    if (input.strategy !== 'recreate') return null;
    if (input.replicas > 1) {
      return 'A service that must run once cannot have more than one replica. Set replicas to 1 first.';
    }
    if (input.autoscaled) {
      return 'A service that must run once cannot be autoscaled. Turn off autoscaling first.';
    }
    return null;
  }
}
