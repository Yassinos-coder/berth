import { Injectable } from '@nestjs/common';
import {
  AdvisorFinding,
  AdvisorFindingStatus,
  AdvisorRun,
  AdvisorSettings,
  BackupStatus,
  DeploymentStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { ADVISOR_METRIC_WINDOW_DAYS } from '../constants/advisor.constants';
import type { CandidateFinding, RawOrgData } from '../interfaces';

const DAY_MS = 24 * 60 * 60 * 1000;

const DECLINE_MEMORY_MS = 30 * 24 * 60 * 60 * 1000;

@Injectable()
export class AdvisorRepository {
  constructor(private readonly prisma: PrismaService) {}

  getSettings(orgId: string): Promise<AdvisorSettings | null> {
    return this.prisma.advisorSettings.findUnique({ where: { orgId } });
  }

  listEnabledSettings(): Promise<AdvisorSettings[]> {
    return this.prisma.advisorSettings.findMany({ where: { enabled: true } });
  }

  upsertSettings(
    orgId: string,
    data: Prisma.AdvisorSettingsUncheckedUpdateInput,
  ): Promise<AdvisorSettings> {
    return this.prisma.advisorSettings.upsert({
      where: { orgId },
      create: { ...(data as Prisma.AdvisorSettingsUncheckedCreateInput), orgId },
      update: data,
    });
  }

  async addSpend(orgId: string, costUsd: number, now: Date): Promise<void> {
    await this.prisma.advisorSettings.updateMany({
      where: { orgId },
      data: { spentUsd: { increment: costUsd }, lastRunAt: now },
    });
  }

  async collect(orgId: string, now: Date): Promise<RawOrgData> {
    const since = new Date(now.getTime() - ADVISOR_METRIC_WINDOW_DAYS * DAY_MS);

    const [servers, services, proxyHosts, backupTargets, allocated] = await Promise.all([
      this.prisma.server.findMany({
        where: { orgId },
        select: { id: true, name: true, cpuCores: true, memoryMb: true, diskGb: true, status: true, storageBudgetGb: true },
      }),
      this.prisma.service.findMany({
        where: { orgId },
        select: {
          id: true,
          name: true,
          kind: true,
          state: true,
          sourceKind: true,
          image: true,
          tag: true,
          replicas: true,
          cpuCores: true,
          memoryMb: true,
          deployStrategy: true,
          autoRollback: true,
          volumePath: true,
          diskGb: true,
          volumeLimited: true,
          serverId: true,
          templateKind: true,
          previewsEnabled: true,
        },
      }),
      this.prisma.proxyHost.findMany({ where: { orgId }, select: { serviceId: true, ssl: true } }),
      this.prisma.backupTarget.count({ where: { orgId } }),
      this.prisma.service.groupBy({
        by: ['serverId'],
        where: { orgId, volumePath: { not: null }, diskGb: { not: null } },
        _sum: { diskGb: true },
      }),
    ]);

    const serviceIds = services.map((service) => service.id);
    const [metricRows, deployRows, backupRows] = await Promise.all([
      serviceIds.length === 0
        ? []
        : this.prisma.metricSample.groupBy({
            by: ['serviceId'],
            where: { serviceId: { in: serviceIds }, ts: { gte: since } },
            _max: { cpuPct: true, memMb: true },
            _avg: { cpuPct: true, memMb: true },
            _count: { _all: true },
          }),
      this.prisma.deployment.groupBy({
        by: ['serviceId', 'status'],
        where: { orgId, createdAt: { gte: since }, status: { in: [DeploymentStatus.live, DeploymentStatus.failed] } },
        _count: { _all: true },
      }),
      this.prisma.backup.groupBy({
        by: ['serviceId'],
        where: { orgId, status: BackupStatus.success },
      }),
    ]);

    const allocatedByServer = new Map(allocated.map((row) => [row.serverId, row._sum.diskGb ?? 0]));
    const deployTotals = new Map<string, { total: number; failed: number }>();
    for (const row of deployRows) {
      const entry = deployTotals.get(row.serviceId) ?? { total: 0, failed: 0 };
      entry.total += row._count._all;
      if (row.status === DeploymentStatus.failed) entry.failed += row._count._all;
      deployTotals.set(row.serviceId, entry);
    }

    return {
      now,
      servers: servers.map((server) => ({ ...server, allocatedDiskGb: allocatedByServer.get(server.id) ?? 0 })),
      services,
      metrics: metricRows.map((row) => ({
        serviceId: row.serviceId,
        peakCpuPct: row._max.cpuPct ?? 0,
        peakMemMb: row._max.memMb ?? 0,
        avgCpuPct: row._avg.cpuPct ?? 0,
        avgMemMb: row._avg.memMb ?? 0,
        samples: row._count._all,
      })),
      deployStats: [...deployTotals].map(([serviceId, value]) => ({ serviceId, ...value })),
      proxyHosts,
      backupTargets,
      servicesWithBackup: backupRows.map((row) => row.serviceId),
    };
  }

  listFindings(orgId: string, statuses: AdvisorFindingStatus[]): Promise<AdvisorFinding[]> {
    return this.prisma.advisorFinding.findMany({
      where: { orgId, status: { in: statuses } },
      orderBy: [{ severity: 'desc' }, { createdAt: 'desc' }],
      take: 200,
    });
  }

  findFinding(orgId: string, id: string): Promise<AdvisorFinding | null> {
    return this.prisma.advisorFinding.findFirst({ where: { id, orgId } });
  }

  async openCounts(orgId: string): Promise<{ open: number; critical: number }> {
    const [open, critical] = await Promise.all([
      this.prisma.advisorFinding.count({ where: { orgId, status: AdvisorFindingStatus.open } }),
      this.prisma.advisorFinding.count({ where: { orgId, status: AdvisorFindingStatus.open, severity: 'critical' } }),
    ]);
    return { open, critical };
  }

  async saveCandidates(
    orgId: string,
    candidates: CandidateFinding[],
    scope: ('rules' | 'ai')[],
  ): Promise<number> {
    const open = await this.prisma.advisorFinding.findMany({
      where: { orgId, status: AdvisorFindingStatus.open },
    });
    const byFingerprint = new Map(open.map((finding) => [finding.fingerprint, finding]));
    const declined = await this.declinedFingerprints(orgId);
    const seen = new Set<string>();
    let kept = 0;

    for (const candidate of candidates) {
      if (declined.has(candidate.fingerprint)) continue;
      seen.add(candidate.fingerprint);
      kept += 1;
      const data = {
        kind: candidate.kind,
        severity: candidate.severity,
        source: candidate.source,
        title: candidate.title,
        detail: candidate.detail,
        evidence: candidate.evidence as unknown as Prisma.InputJsonValue,
        action: (candidate.action ?? Prisma.DbNull) as Prisma.InputJsonValue,
        serviceId: candidate.serviceId ?? null,
        serverId: candidate.serverId ?? null,
      };
      const existing = byFingerprint.get(candidate.fingerprint);
      if (existing) {
        await this.prisma.advisorFinding.update({ where: { id: existing.id }, data });
      } else {
        await this.prisma.advisorFinding.create({
          data: { orgId, fingerprint: candidate.fingerprint, ...data },
        });
      }
    }

    const stale = open.filter(
      (finding) =>
        !seen.has(finding.fingerprint) && scope.includes(finding.source as 'rules' | 'ai'),
    );
    if (stale.length > 0) {
      await this.prisma.advisorFinding.updateMany({
        where: { id: { in: stale.map((finding) => finding.id) } },
        data: { status: AdvisorFindingStatus.superseded, resolvedAt: new Date() },
      });
    }
    return kept;
  }

  private async declinedFingerprints(orgId: string): Promise<Set<string>> {
    const since = new Date(Date.now() - DECLINE_MEMORY_MS);
    const rows = await this.prisma.advisorFinding.findMany({
      where: { orgId, status: AdvisorFindingStatus.dismissed, resolvedAt: { gte: since } },
      select: { fingerprint: true },
    });
    return new Set(rows.map((row) => row.fingerprint));
  }

  markResolved(
    id: string,
    status: AdvisorFindingStatus,
    resolvedBy: string,
    undo?: Prisma.InputJsonValue,
  ): Promise<AdvisorFinding> {
    return this.prisma.advisorFinding.update({
      where: { id },
      data: { status, resolvedBy, resolvedAt: new Date(), ...(undo !== undefined ? { undo } : {}) },
    });
  }

  clearUndo(id: string, resolvedBy: string): Promise<AdvisorFinding> {
    return this.prisma.advisorFinding.update({
      where: { id },
      data: { undo: Prisma.DbNull, status: AdvisorFindingStatus.dismissed, resolvedBy, resolvedAt: new Date() },
    });
  }

  startRun(orgId: string): Promise<AdvisorRun> {
    return this.prisma.advisorRun.create({ data: { orgId } });
  }

  finishRun(
    id: string,
    data: { usedAi: boolean; tokensIn: number; tokensOut: number; costUsd: number; findings: number; error?: string },
  ): Promise<AdvisorRun> {
    return this.prisma.advisorRun.update({ where: { id }, data: { ...data, finishedAt: new Date() } });
  }

  servicesBrief(orgId: string, ids: string[]) {
    if (ids.length === 0) return Promise.resolve([]);
    return this.prisma.service.findMany({
      where: { orgId, id: { in: ids } },
      select: { id: true, name: true, cpuCores: true, memoryMb: true, diskGb: true },
    });
  }

  currentService(orgId: string, id: string) {
    return this.prisma.service.findFirst({
      where: { id, orgId },
      select: { id: true, name: true, cpuCores: true, memoryMb: true, diskGb: true, autoRollback: true, volumeLimited: true, volumePath: true },
    });
  }

  async serviceIds(orgId: string): Promise<Set<string>> {
    const rows = await this.prisma.service.findMany({ where: { orgId }, select: { id: true } });
    return new Set(rows.map((row) => row.id));
  }
}
