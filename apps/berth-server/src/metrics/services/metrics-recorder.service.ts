import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { MetricSampleRepository } from '../repositories/metric-sample.repository';
import type { AlertKind, AlertWatch, MetricAccumulator, MetricReading } from '../interfaces';
import { MetricAlertRulesUtil } from '../utils/metric-alert-rules.util';
import { METRIC_RETENTION_MS } from '../validators/metric-range.validator';

const FLUSH_INTERVAL_MS = 60_000;
const PRUNE_EVERY_FLUSHES = 60;
const HOST_ALERT_COOLDOWN_MS = 6 * 60 * 60_000;

const ALERT_LABEL: Record<AlertKind, string> = {
  cpu: 'CPU',
  memory: 'memory',
};

@Injectable()
export class MetricsRecorderService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MetricsRecorderService.name);
  private readonly pending = new Map<string, MetricAccumulator>();
  private readonly watches = new Map<string, AlertWatch>();
  private readonly hostAlertedAt = new Map<string, number>();
  private timer?: NodeJS.Timeout;
  private flushes = 0;
  private flushing = false;

  constructor(
    private readonly repository: MetricSampleRepository,
    private readonly notifications: NotificationsService,
  ) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), FLUSH_INTERVAL_MS);
    this.timer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer);
    await this.flush();
  }

  record(serviceId: string, reading: Omit<MetricReading, 'ts'>): void {
    const entry = this.pending.get(serviceId) ?? {
      count: 0,
      cpuSum: 0,
      memMax: 0,
      netRxMb: 0,
      netTxMb: 0,
    };
    entry.count += 1;
    entry.cpuSum += reading.cpuPct;
    entry.memMax = Math.max(entry.memMax, reading.memMb);
    entry.netRxMb = reading.netRxMb;
    entry.netTxMb = reading.netTxMb;
    this.pending.set(serviceId, entry);
  }

  async observeHostDisk(serverId: string, usedGb: number, totalGb: number): Promise<void> {
    if (!MetricAlertRulesUtil.diskHigh(usedGb, totalGb)) return;
    const now = Date.now();
    const last = this.hostAlertedAt.get(serverId);
    if (last !== undefined && now - last < HOST_ALERT_COOLDOWN_MS) return;
    this.hostAlertedAt.set(serverId, now);

    const server = await this.repository.serverInfo(serverId);
    if (!server) return;
    await this.notifications.notify(server.orgId, {
      type: 'resource.high',
      title: `Disk almost full on ${server.name}`,
      detail: `${usedGb.toFixed(1)} of ${totalGb.toFixed(1)} GB used. Free space or expand the disk before deployments start failing.`,
      severity: 'warning',
    });
  }

  async flush(now = Date.now()): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const batch = new Map(this.pending);
      this.pending.clear();
      await this.persist(batch, now);
      await this.alert(batch, now);
      this.flushes += 1;
      if (this.flushes % PRUNE_EVERY_FLUSHES === 0) {
        await this.repository.prune(new Date(now - METRIC_RETENTION_MS));
      }
    } catch (error) {
      this.logger.warn(`metrics flush failed: ${error}`);
    } finally {
      this.flushing = false;
    }
  }

  private async persist(batch: Map<string, MetricAccumulator>, now: number): Promise<void> {
    const ts = new Date(Math.floor(now / 60_000) * 60_000);
    await this.repository.createMany(
      [...batch.entries()].map(([serviceId, entry]) => ({
        serviceId,
        ts,
        cpuPct: entry.cpuSum / entry.count,
        memMb: entry.memMax,
        netRxMb: entry.netRxMb,
        netTxMb: entry.netTxMb,
      })),
    );
  }

  private async alert(batch: Map<string, MetricAccumulator>, now: number): Promise<void> {
    for (const id of this.watches.keys()) {
      if (!batch.has(id)) this.watches.delete(id);
    }
    if (batch.size === 0) return;

    const services = await this.repository.serviceLimits([...batch.keys()]);
    for (const service of services) {
      const entry = batch.get(service.id);
      if (!entry) continue;
      const { watch, fired } = MetricAlertRulesUtil.evaluate(
        this.watches.get(service.id) ?? MetricAlertRulesUtil.emptyWatch(),
        { cpuPct: entry.cpuSum / entry.count, memMb: entry.memMax },
        { cpuCores: service.cpuCores, memoryMb: service.memoryMb },
        now,
      );
      this.watches.set(service.id, watch);
      for (const kind of fired) {
        await this.notifications.notify(service.orgId, {
          type: 'resource.high',
          title: `High ${ALERT_LABEL[kind]} on ${service.name}`,
          detail: `${service.name} has been using over 90% of its ${ALERT_LABEL[kind]} limit for 5+ minutes. Raise the limit or enable smart resources.`,
          severity: 'warning',
        });
      }
    }
  }
}
