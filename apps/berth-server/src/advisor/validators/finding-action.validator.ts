import type { AdvisorAction } from '@berth/protocol';
import { LIMITS } from '../constants/advisor.constants';

export interface ActionContext {
  serviceExists: (serviceId: string) => boolean;
}

export class FindingActionValidator {
  static parse(value: unknown): AdvisorAction | null {
    if (typeof value !== 'object' || value === null) return null;
    const raw = value as Record<string, unknown>;
    const serviceId = raw.serviceId;
    if (typeof serviceId !== 'string' || serviceId.length === 0 || serviceId.length > 64) return null;

    if (raw.type === 'enable-auto-rollback') {
      return { type: 'enable-auto-rollback', serviceId };
    }
    if (raw.type === 'set-disk-size') {
      const diskGb = raw.diskGb;
      if (!Number.isInteger(diskGb)) return null;
      return { type: 'set-disk-size', serviceId, diskGb: diskGb as number };
    }
    if (raw.type === 'set-resources') {
      const cpuCores = raw.cpuCores;
      const memoryMb = raw.memoryMb;
      if (cpuCores === undefined && memoryMb === undefined) return null;
      if (cpuCores !== undefined && (typeof cpuCores !== 'number' || !Number.isFinite(cpuCores))) return null;
      if (memoryMb !== undefined && !Number.isInteger(memoryMb)) return null;
      return {
        type: 'set-resources',
        serviceId,
        ...(cpuCores !== undefined ? { cpuCores: cpuCores as number } : {}),
        ...(memoryMb !== undefined ? { memoryMb: memoryMb as number } : {}),
      };
    }
    return null;
  }

  static boundsError(action: AdvisorAction): string | null {
    if (action.type === 'set-resources') {
      if (action.cpuCores !== undefined && (action.cpuCores < LIMITS.cpuCores.min || action.cpuCores > LIMITS.cpuCores.max)) {
        return `CPU must be between ${LIMITS.cpuCores.min} and ${LIMITS.cpuCores.max} vCPU.`;
      }
      if (action.memoryMb !== undefined && (action.memoryMb < LIMITS.memoryMb.min || action.memoryMb > LIMITS.memoryMb.max)) {
        return `Memory must be between ${LIMITS.memoryMb.min} MB and ${LIMITS.memoryMb.max} MB.`;
      }
    }
    if (action.type === 'set-disk-size') {
      if (action.diskGb < LIMITS.diskGb.min || action.diskGb > LIMITS.diskGb.max) {
        return `Storage must be between ${LIMITS.diskGb.min} and ${LIMITS.diskGb.max} GB.`;
      }
    }
    return null;
  }

  static validate(value: unknown, context: ActionContext): { action?: AdvisorAction; error?: string } {
    const action = FindingActionValidator.parse(value);
    if (!action) return { error: 'This suggestion has no valid action.' };
    if (!context.serviceExists(action.serviceId)) return { error: 'The service no longer exists.' };
    const bounds = FindingActionValidator.boundsError(action);
    if (bounds) return { error: bounds };
    return { action };
  }

  static describe(action: AdvisorAction, serviceName: string, current?: { cpuCores: number; memoryMb: number; diskGb?: number }): string {
    if (action.type === 'enable-auto-rollback') return `Turn on automatic rollback for ${serviceName}`;
    if (action.type === 'set-disk-size') {
      return `Set ${serviceName}'s storage to ${action.diskGb} GB${current?.diskGb ? ` (now ${current.diskGb} GB)` : ''}`;
    }
    const parts: string[] = [];
    if (action.memoryMb !== undefined) {
      parts.push(`memory ${current ? `${current.memoryMb} MB → ` : ''}${action.memoryMb} MB`);
    }
    if (action.cpuCores !== undefined) {
      parts.push(`CPU ${current ? `${current.cpuCores} → ` : ''}${action.cpuCores} vCPU`);
    }
    return `Change ${serviceName}: ${parts.join(', ')}`;
  }
}
