import type { AdvisorAction } from '@berth/protocol';
import type { UpdateServiceDto } from '../../services/dto/update-service.dto';
import type { UndoRecord } from '../interfaces';

export interface CurrentServiceState {
  cpuCores: number;
  memoryMb: number;
  diskGb: number | null;
  autoRollback: boolean;
}

export class UndoMapper {
  static toUpdate(action: AdvisorAction): UpdateServiceDto {
    if (action.type === 'enable-auto-rollback') return { autoRollback: true } as UpdateServiceDto;
    if (action.type === 'set-disk-size') return { diskGb: action.diskGb } as UpdateServiceDto;
    return {
      resources: {
        ...(action.cpuCores !== undefined ? { cpuCores: action.cpuCores } : {}),
        ...(action.memoryMb !== undefined ? { memoryMb: action.memoryMb } : {}),
      },
    } as UpdateServiceDto;
  }

  static capture(action: AdvisorAction, current: CurrentServiceState): UndoRecord {
    if (action.type === 'enable-auto-rollback') {
      return { serviceId: action.serviceId, autoRollback: current.autoRollback };
    }
    if (action.type === 'set-disk-size') {
      return { serviceId: action.serviceId, ...(current.diskGb ? { diskGb: current.diskGb } : {}) };
    }
    return {
      serviceId: action.serviceId,
      ...(action.cpuCores !== undefined ? { cpuCores: current.cpuCores } : {}),
      ...(action.memoryMb !== undefined ? { memoryMb: current.memoryMb } : {}),
    };
  }

  static parse(value: unknown): UndoRecord | null {
    if (typeof value !== 'object' || value === null) return null;
    const raw = value as Record<string, unknown>;
    if (typeof raw.serviceId !== 'string') return null;
    return {
      serviceId: raw.serviceId,
      ...(typeof raw.cpuCores === 'number' ? { cpuCores: raw.cpuCores } : {}),
      ...(typeof raw.memoryMb === 'number' ? { memoryMb: raw.memoryMb } : {}),
      ...(typeof raw.diskGb === 'number' ? { diskGb: raw.diskGb } : {}),
      ...(typeof raw.autoRollback === 'boolean' ? { autoRollback: raw.autoRollback } : {}),
    };
  }

  static toRestore(undo: UndoRecord): UpdateServiceDto {
    const resources = {
      ...(undo.cpuCores !== undefined ? { cpuCores: undo.cpuCores } : {}),
      ...(undo.memoryMb !== undefined ? { memoryMb: undo.memoryMb } : {}),
    };
    return {
      ...(Object.keys(resources).length > 0 ? { resources } : {}),
      ...(undo.diskGb !== undefined ? { diskGb: undo.diskGb } : {}),
      ...(undo.autoRollback !== undefined ? { autoRollback: undo.autoRollback } : {}),
    } as UpdateServiceDto;
  }
}
