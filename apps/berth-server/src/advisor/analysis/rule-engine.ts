import { StorageMath } from '@berth/protocol';
import {
  ADVISOR_MAX_FINDINGS,
  ADVISOR_MIN_SAMPLES,
  ADVISOR_MIN_SAMPLES_FOR_DOWNSIZE,
  MEMORY_TIERS_MB,
} from '../constants/advisor.constants';
import type {
  AdvisorSnapshot,
  CandidateFinding,
  SnapshotService,
} from '../interfaces';

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 } as const;
const STATEFUL_KINDS = new Set(['database', 'bucket']);

const formatMb = (mb: number): string => (mb >= 1024 ? `${Math.round((mb / 1024) * 10) / 10} GB` : `${Math.round(mb)} MB`);

export class RuleEngine {
  static nextMemoryTier(minimumMb: number): number {
    return MEMORY_TIERS_MB.find((tier) => tier >= minimumMb) ?? MEMORY_TIERS_MB[MEMORY_TIERS_MB.length - 1];
  }

  static evaluate(snapshot: AdvisorSnapshot): CandidateFinding[] {
    const findings: CandidateFinding[] = [];
    for (const service of snapshot.services) {
      findings.push(
        ...RuleEngine.memory(service),
        ...RuleEngine.cpu(service),
        ...RuleEngine.health(service),
        ...RuleEngine.storage(service),
        ...RuleEngine.rollback(service),
        ...RuleEngine.backups(service, snapshot.backupTargets),
        ...RuleEngine.exposure(service),
      );
    }
    findings.push(...RuleEngine.servers(snapshot));

    return findings
      .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity])
      .slice(0, ADVISOR_MAX_FINDINGS);
  }

  private static memory(service: SnapshotService): CandidateFinding[] {
    const usage = service.usage;
    if (!usage || usage.samples < ADVISOR_MIN_SAMPLES || service.state === 'stopped') return [];
    const limit = service.memoryMb;
    const peakPct = (usage.peakMemMb / limit) * 100;

    if (peakPct >= 85) {
      const target = RuleEngine.nextMemoryTier(Math.ceil(usage.peakMemMb * 1.3));
      if (target <= limit) return [];
      return [
        {
          fingerprint: `memory-raise:${service.id}`,
          kind: 'resources',
          severity: peakPct >= 97 ? 'critical' : 'warning',
          source: 'rules',
          serviceId: service.id,
          title: `${service.name} is close to its memory limit`,
          detail: `${service.name} reached ${formatMb(usage.peakMemMb)} of its ${formatMb(limit)} limit in the last 7 days. At the limit the process is killed and restarted. Giving it ${formatMb(target)} leaves room to breathe.`,
          evidence: [
            `Peak memory ${formatMb(usage.peakMemMb)} of ${formatMb(limit)} (${Math.round(peakPct)}%)`,
            `Average memory ${formatMb(usage.avgMemMb)}`,
            `${usage.samples} samples over 7 days`,
          ],
          action: { type: 'set-resources', serviceId: service.id, memoryMb: target },
        },
      ];
    }

    if (
      usage.samples >= ADVISOR_MIN_SAMPLES_FOR_DOWNSIZE &&
      limit >= 1024 &&
      peakPct <= 35 &&
      service.deployments7d.failed === 0
    ) {
      const target = Math.max(256, RuleEngine.nextMemoryTier(Math.ceil(usage.peakMemMb * 1.8)));
      if (target >= limit) return [];
      return [
        {
          fingerprint: `memory-lower:${service.id}`,
          kind: 'cost',
          severity: 'info',
          source: 'rules',
          serviceId: service.id,
          title: `${service.name} has more memory than it uses`,
          detail: `${service.name} peaked at ${formatMb(usage.peakMemMb)} in the last 7 days but is allowed ${formatMb(limit)}. Lowering the limit to ${formatMb(target)} frees ${formatMb(limit - target)} for other services, and still leaves almost double its peak.`,
          evidence: [
            `Peak memory ${formatMb(usage.peakMemMb)} of ${formatMb(limit)} (${Math.round(peakPct)}%)`,
            `Average memory ${formatMb(usage.avgMemMb)}`,
          ],
          action: { type: 'set-resources', serviceId: service.id, memoryMb: target },
        },
      ];
    }
    return [];
  }

  private static cpu(service: SnapshotService): CandidateFinding[] {
    const usage = service.usage;
    if (!usage || usage.samples < ADVISOR_MIN_SAMPLES_FOR_DOWNSIZE || service.state === 'stopped') return [];
    if (usage.avgCpuPct < 80) return [];
    return [
      {
        fingerprint: `cpu-sustained:${service.id}`,
        kind: 'resources',
        severity: 'warning',
        source: 'rules',
        serviceId: service.id,
        title: `${service.name} keeps its CPU busy`,
        detail: `${service.name} averaged ${Math.round(usage.avgCpuPct)}% CPU over the last 7 days. A service this busy slows down under extra load. Consider more CPU or more replicas.`,
        evidence: [`Average CPU ${Math.round(usage.avgCpuPct)}%`, `Peak CPU ${Math.round(usage.peakCpuPct)}%`],
      },
    ];
  }

  private static health(service: SnapshotService): CandidateFinding[] {
    const findings: CandidateFinding[] = [];
    if (service.state === 'crashed' || service.state === 'unhealthy') {
      findings.push({
        fingerprint: `down:${service.id}`,
        kind: 'reliability',
        severity: 'critical',
        source: 'rules',
        serviceId: service.id,
        title: `${service.name} is ${service.state}`,
        detail: `${service.name} is not serving right now. Check its logs and recent deployments.`,
        evidence: [`State: ${service.state}`],
      });
    }
    const { total, failed } = service.deployments7d;
    if (total >= 3 && failed / total >= 0.5) {
      findings.push({
        fingerprint: `deploys-failing:${service.id}`,
        kind: 'reliability',
        severity: 'warning',
        source: 'rules',
        serviceId: service.id,
        title: `Most deploys of ${service.name} are failing`,
        detail: `${failed} of the last ${total} deployments of ${service.name} failed. Look at the latest build log.`,
        evidence: [`${failed} of ${total} deployments failed in 7 days`],
      });
    }
    return findings;
  }

  private static storage(service: SnapshotService): CandidateFinding[] {
    if (!service.storage.mounted || service.storage.limited) return [];
    return [
      {
        fingerprint: `volume-unlimited:${service.id}`,
        kind: 'storage',
        severity: 'warning',
        source: 'rules',
        serviceId: service.id,
        title: `${service.name}'s storage has no size limit`,
        detail: `${service.name} can keep writing until the whole disk is full, which would take other services down with it. Open its Settings and use "Enforce limit" to give it a hard size.`,
        evidence: ['Persistent volume without a limit'],
      },
    ];
  }

  private static rollback(service: SnapshotService): CandidateFinding[] {
    if (service.source.kind !== 'git' || service.autoRollback) return [];
    return [
      {
        fingerprint: `auto-rollback-off:${service.id}`,
        kind: 'reliability',
        severity: 'info',
        source: 'rules',
        serviceId: service.id,
        title: `Automatic rollback is off for ${service.name}`,
        detail: `With it on, a new version that crashes within 15 minutes is replaced by the last working one, and you are told.`,
        evidence: ['Automatic rollback: off'],
        action: { type: 'enable-auto-rollback', serviceId: service.id },
      },
    ];
  }

  private static backups(service: SnapshotService, backupTargets: number): CandidateFinding[] {
    if (!STATEFUL_KINDS.has(service.kind) || service.hasBackup) return [];
    return [
      {
        fingerprint: `no-backup:${service.id}`,
        kind: 'reliability',
        severity: 'warning',
        source: 'rules',
        serviceId: service.id,
        title: `${service.name} has never been backed up`,
        detail:
          backupTargets === 0
            ? `${service.name} holds data but no backup destination is set up. Add one under Settings, then back it up.`
            : `${service.name} holds data and has no backup yet. Run one now, so a mistake or disk failure is recoverable.`,
        evidence: ['No successful backup on record'],
      },
    ];
  }

  private static exposure(service: SnapshotService): CandidateFinding[] {
    if (service.domains.count === 0 || service.domains.allHttps) return [];
    return [
      {
        fingerprint: `plain-http:${service.id}`,
        kind: 'security',
        severity: 'warning',
        source: 'rules',
        serviceId: service.id,
        title: `${service.name} is served over plain HTTP`,
        detail: `At least one domain for ${service.name} has HTTPS turned off, so visitors' traffic is not encrypted. Turn on Automatic HTTPS for it under Proxy Hosts.`,
        evidence: ['A domain has HTTPS off'],
      },
    ];
  }

  private static servers(snapshot: AdvisorSnapshot): CandidateFinding[] {
    const findings: CandidateFinding[] = [];
    for (const server of snapshot.servers) {
      const { budgetGb, allocatedGb } = server.storage;
      if (budgetGb === null) {
        findings.push({
          fingerprint: `no-budget:${server.id}`,
          kind: 'storage',
          severity: 'info',
          source: 'rules',
          serverId: server.id,
          title: `${server.name} has no storage budget`,
          detail: `Without a budget, services on ${server.name} can use the whole disk. Set how much Berth may use on the server's page.`,
          evidence: [`Disk ${server.diskGb} GB, no Berth budget`],
        });
        continue;
      }
      const allocatable = StorageMath.allocatableGb(budgetGb);
      if (allocatable > 0 && allocatedGb / allocatable >= 0.9) {
        findings.push({
          fingerprint: `budget-full:${server.id}`,
          kind: 'storage',
          severity: 'warning',
          source: 'rules',
          serverId: server.id,
          title: `${server.name}'s storage budget is almost fully allocated`,
          detail: `${allocatedGb} of ${allocatable} GB is promised to services, so a new volume may not fit. Raise the budget on the server's page if the disk has room.`,
          evidence: [`${allocatedGb} of ${allocatable} GB allocated (${Math.round((allocatedGb / allocatable) * 100)}%)`],
        });
      }
    }
    return findings;
  }
}
