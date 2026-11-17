import { ADVISOR_METRIC_WINDOW_DAYS } from '../constants/advisor.constants';
import type {
  AdvisorSnapshot,
  RawOrgData,
  SnapshotServer,
  SnapshotService,
} from '../interfaces';

const round = (value: number, digits = 1): number => {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
};

/**
 * Builds the only data that may leave the panel for an AI provider.
 * Every object is constructed from named fields. Nothing is spread, so a
 * field that is not listed here (environment variables, secrets, tokens,
 * registry credentials, repository URLs, domain names) can never be included.
 */
export class SnapshotBuilder {
  static build(raw: RawOrgData): AdvisorSnapshot {
    const metrics = new Map(raw.metrics.map((item) => [item.serviceId, item]));
    const deploys = new Map(raw.deployStats.map((item) => [item.serviceId, item]));
    const withBackup = new Set(raw.servicesWithBackup);
    const hostsByService = new Map<string, boolean[]>();
    for (const host of raw.proxyHosts) {
      const list = hostsByService.get(host.serviceId) ?? [];
      list.push(host.ssl);
      hostsByService.set(host.serviceId, list);
    }

    const servers: SnapshotServer[] = raw.servers.map((server) => ({
      id: server.id,
      name: server.name,
      cpuCores: server.cpuCores,
      memoryMb: server.memoryMb,
      diskGb: server.diskGb,
      status: server.status,
      storage: { budgetGb: server.storageBudgetGb, allocatedGb: server.allocatedDiskGb },
    }));

    const services: SnapshotService[] = raw.services.map((service) => {
      const usage = metrics.get(service.id);
      const hosts = hostsByService.get(service.id) ?? [];
      const stats = deploys.get(service.id);
      const mounted = Boolean(service.volumePath);
      return {
        id: service.id,
        name: service.name,
        kind: service.kind,
        state: service.state,
        source: {
          kind: service.sourceKind,
          ...(service.image ? { image: service.image } : {}),
          ...(service.tag ? { tag: service.tag } : {}),
        },
        replicas: service.replicas,
        cpuCores: service.cpuCores,
        memoryMb: service.memoryMb,
        deployStrategy: service.deployStrategy,
        autoRollback: service.autoRollback,
        storage: {
          mounted,
          ...(mounted && service.diskGb ? { sizeGb: service.diskGb } : {}),
          limited: mounted && service.volumeLimited,
        },
        serverId: service.serverId,
        ...(usage && usage.samples > 0
          ? {
              usage: {
                peakMemMb: round(usage.peakMemMb),
                avgMemMb: round(usage.avgMemMb),
                peakCpuPct: round(usage.peakCpuPct),
                avgCpuPct: round(usage.avgCpuPct),
                samples: usage.samples,
              },
            }
          : {}),
        deployments7d: { total: stats?.total ?? 0, failed: stats?.failed ?? 0 },
        domains: { count: hosts.length, allHttps: hosts.every(Boolean) },
        hasBackup: withBackup.has(service.id),
      };
    });

    return {
      generatedAt: raw.now.toISOString(),
      windowDays: ADVISOR_METRIC_WINDOW_DAYS,
      servers,
      services,
      backupTargets: raw.backupTargets,
    };
  }
}
