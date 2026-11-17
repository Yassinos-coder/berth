import { Injectable, NotFoundException } from '@nestjs/common';
import type { EdgeStatEntry } from '@berth/protocol';
import { NotificationsService } from '../../notifications/services/notifications.service';
import { EdgeSampleRepository } from '../repositories/edge-sample.repository';
import type { EdgeTrafficDto } from '../interfaces';
import { EdgeAlertRulesUtil, EDGE_ALERT_WINDOW_MS } from '../utils/edge-alert-rules.util';
import { EdgeTrafficBucketerUtil } from '../utils/edge-traffic-bucketer.util';
import { EdgeEntryValidator } from '../validators/edge-entry.validator';
import { METRIC_RETENTION_MS, MetricRangeValidator } from '../validators/metric-range.validator';

const PRUNE_EVERY_RECORDS = 60;

@Injectable()
export class EdgeTrafficService {
  private readonly alertedAt = new Map<string, number>();
  private records = 0;

  constructor(
    private readonly repository: EdgeSampleRepository,
    private readonly notifications: NotificationsService,
  ) {}

  async traffic(orgId: string, serviceId: string, range?: string): Promise<EdgeTrafficDto> {
    const spec = MetricRangeValidator.resolve(range);
    const samples = await this.repository.inRange(orgId, serviceId, new Date(Date.now() - spec.rangeMs));
    if (!samples) throw new NotFoundException('Service not found');
    return EdgeTrafficBucketerUtil.summarise(samples, spec.bucketMs);
  }

  async record(serverId: string, entries: EdgeStatEntry[], now = Date.now()): Promise<void> {
    const valid = entries.filter((entry) => EdgeEntryValidator.sane(entry));
    if (valid.length === 0) return;

    const owners = await this.repository.ownersByDomain(serverId, valid.map((entry) => entry.domain.toLowerCase()));
    const ts = new Date(Math.floor(now / 60_000) * 60_000);
    const perService = new Map<string, { requests: number; errors4xx: number; errors5xx: number; p95Ms: number; weight: number }>();

    for (const entry of valid) {
      const owner = owners.get(entry.domain.toLowerCase());
      if (!owner) continue;
      const row = perService.get(owner.serviceId) ?? { requests: 0, errors4xx: 0, errors5xx: 0, p95Ms: 0, weight: 0 };
      row.requests += entry.requests;
      row.errors4xx += entry.status4xx;
      row.errors5xx += entry.status5xx;
      row.p95Ms += entry.p95Ms * entry.requests;
      row.weight += entry.requests;
      perService.set(owner.serviceId, row);
    }

    await this.repository.add(
      [...perService.entries()].map(([serviceId, row]) => ({
        serviceId,
        ts,
        requests: row.requests,
        errors4xx: row.errors4xx,
        errors5xx: row.errors5xx,
        p95Ms: Math.round(row.p95Ms / row.weight),
      })),
    );

    for (const [serviceId] of perService) {
      const owner = [...owners.values()].find((item) => item.serviceId === serviceId);
      if (owner) await this.alertIfFailing(owner.orgId, serviceId, owner.serviceName, now);
    }

    this.records += 1;
    if (this.records % PRUNE_EVERY_RECORDS === 0) {
      await this.repository.prune(new Date(now - METRIC_RETENTION_MS));
    }
  }

  private async alertIfFailing(orgId: string, serviceId: string, name: string, now: number): Promise<void> {
    const recent = await this.repository.recent(serviceId, new Date(now - EDGE_ALERT_WINDOW_MS));
    if (!EdgeAlertRulesUtil.shouldAlert(recent, this.alertedAt.get(serviceId), now)) return;
    this.alertedAt.set(serviceId, now);
    const { requests, rate } = EdgeAlertRulesUtil.errorRate(recent);
    await this.notifications.notify(orgId, {
      type: 'resource.high',
      title: `${name} is returning errors`,
      detail: `${Math.round(rate * 100)}% of the last ${requests} requests failed with a server error (5xx). Check the service's logs and recent deploys.`,
      severity: 'warning',
    });
  }
}
