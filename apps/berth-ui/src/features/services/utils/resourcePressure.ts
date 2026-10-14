export type PressureLevel = 'ok' | 'high' | 'critical';

export interface Pressure {
  ratio: number;
  level: PressureLevel;
}

const HIGH_RATIO = 0.85;
const CRITICAL_RATIO = 0.95;
const CPU_PCT_PER_CORE = 100;

export class ResourcePressure {
  static memory(usedMb: number, limitMb: number): Pressure {
    return ResourcePressure.classify(usedMb / Math.max(limitMb, 1));
  }

  static cpu(cpuPct: number, cores: number): Pressure {
    return ResourcePressure.classify(cpuPct / Math.max(cores * CPU_PCT_PER_CORE, 1));
  }

  static warning(memory: Pressure, cpu: Pressure): string | null {
    if (memory.level === 'critical') {
      return 'Memory is almost at its limit. The container is killed when it runs out, so raise the memory limit.';
    }
    if (cpu.level === 'critical') {
      return 'CPU is saturated at its limit, so the service will be slow. Raise the CPU limit.';
    }
    if (memory.level === 'high') {
      return 'Memory is close to its limit. Raise it if the service restarts unexpectedly.';
    }
    if (cpu.level === 'high') {
      return 'CPU is close to its limit and may throttle the service.';
    }
    return null;
  }

  private static classify(ratio: number): Pressure {
    if (ratio >= CRITICAL_RATIO) return { ratio, level: 'critical' };
    if (ratio >= HIGH_RATIO) return { ratio, level: 'high' };
    return { ratio, level: 'ok' };
  }
}
