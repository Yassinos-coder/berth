import { StorageMath } from '@berth/protocol';
import type { Server, Service } from '@/interfaces';

export interface CapacityLine {
  used: number;
  total: number;
  after: number;
  unit: string;
}

export interface StorageLine {
  budgetGb: number | null;
  allocatableGb: number | null;
  allocatedGb: number;
  afterGb: number;
}

export interface CapacityReport {
  cpu: CapacityLine;
  memory: CapacityLine;
  storage: StorageLine;
  problems: string[];
}

export interface CapacityRequest {
  cpuCores: number;
  memoryMb: number;
  storageGb: number;
}

export class ServerCapacity {
  static compute(
    server: Server | undefined,
    services: Pick<Service, 'serverId' | 'state' | 'replicas' | 'resources'>[],
    request: CapacityRequest,
  ): CapacityReport | null {
    if (!server) return null;
    const running = services.filter((s) => s.serverId === server.id && s.state !== 'stopped');
    const usedCpu = running.reduce((sum, s) => sum + s.resources.cpuCores * s.replicas, 0);
    const usedMem = running.reduce((sum, s) => sum + s.resources.memoryMb * s.replicas, 0);

    const budgetGb = server.storage?.budgetGb ?? null;
    const allocatedGb = server.storage?.allocatedGb ?? 0;
    const allocatableGb = budgetGb === null ? null : StorageMath.allocatableGb(budgetGb);

    const report: CapacityReport = {
      cpu: { used: usedCpu, total: server.cpuCores, after: usedCpu + request.cpuCores, unit: 'vCPU' },
      memory: { used: usedMem, total: server.memoryMb, after: usedMem + request.memoryMb, unit: 'MB' },
      storage: { budgetGb, allocatableGb, allocatedGb, afterGb: allocatedGb + request.storageGb },
      problems: [],
    };

    if (report.cpu.after > report.cpu.total) {
      report.problems.push(
        `${server.name} has ${round(report.cpu.total - usedCpu)} vCPU unallocated, and this needs ${request.cpuCores}.`,
      );
    }
    if (report.memory.after > report.memory.total) {
      report.problems.push(
        `${server.name} has ${Math.max(0, report.memory.total - usedMem)} MB of memory unallocated, and this needs ${request.memoryMb} MB.`,
      );
    }
    if (allocatableGb !== null && request.storageGb > 0 && report.storage.afterGb > allocatableGb) {
      report.problems.push(
        `Only ${Math.max(0, allocatableGb - allocatedGb)} GB of ${server.name}'s Berth storage is free, and this needs ${request.storageGb} GB.`,
      );
    }
    return report;
  }
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
