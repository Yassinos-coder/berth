import { BadRequestException, Injectable, NotFoundException, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { JobRunStatus, type ScheduledJob } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AgentRegistry } from '../agent-gateway/registry/agent-registry.service';
import type { AuthenticatedUser } from '../common/interfaces';
import type { CreateJobDto } from './dto/create-job.dto';

@Injectable()
export class JobsService implements OnModuleInit, OnApplicationShutdown {
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService, private readonly agents: AgentRegistry) {}

  onModuleInit(): void {
    this.timer = setInterval(() => void this.tick(), 30_000);
    this.timer.unref();
  }
  onApplicationShutdown(): void { if (this.timer) clearInterval(this.timer); }

  async list(orgId: string, serviceId: string) {
    await this.assertService(orgId, serviceId);
    return this.prisma.scheduledJob.findMany({ where: { orgId, serviceId }, orderBy: { createdAt: 'desc' }, include: { runs: { orderBy: { createdAt: 'desc' }, take: 10 } } });
  }

  async create(user: AuthenticatedUser, serviceId: string, dto: CreateJobDto) {
    await this.assertService(user.orgId, serviceId);
    validateCron(dto.cron, dto.timezone ?? 'UTC');
    return this.prisma.scheduledJob.create({ data: { orgId: user.orgId, serviceId, name: dto.name.trim(), command: dto.command, cron: dto.cron.trim(), timezone: dto.timezone ?? 'UTC', enabled: dto.enabled ?? true } });
  }

  async remove(orgId: string, serviceId: string, id: string): Promise<void> {
    const result = await this.prisma.scheduledJob.deleteMany({ where: { id, orgId, serviceId } });
    if (!result.count) throw new NotFoundException('Scheduled job not found');
  }

  async run(user: AuthenticatedUser, serviceId: string, command: string[], jobId?: string) {
    const service = await this.assertService(user.orgId, serviceId);
    if (jobId) {
      const job = await this.prisma.scheduledJob.findFirst({ where: { id: jobId, orgId: user.orgId, serviceId } });
      if (!job) throw new NotFoundException('Scheduled job not found');
      command = job.command;
    }
    const run = await this.prisma.jobRun.create({ data: { orgId: user.orgId, serviceId, jobId, command, status: JobRunStatus.running, startedAt: new Date() } });
    const sent = this.agents.send(service.serverId, { type: 'RunCommand', runId: run.id, containerName: `berth-${serviceId}`, command });
    if (!sent) {
      await this.prisma.jobRun.update({ where: { id: run.id }, data: { status: JobRunStatus.failed, output: 'Agent is offline', finishedAt: new Date() } });
      throw new BadRequestException('Agent is offline');
    }
    return run;
  }

  private async tick(): Promise<void> {
    const now = new Date();
    const jobs = await this.prisma.scheduledJob.findMany({ where: { enabled: true }, include: { service: { select: { serverId: true } } } });
    for (const job of jobs) {
      if (job.lastRunAt && now.getTime() - job.lastRunAt.getTime() < 55_000) continue;
      if (!cronMatches(job.cron, job.timezone, now)) continue;
      const claimed = await this.prisma.scheduledJob.updateMany({ where: { id: job.id, OR: [{ lastRunAt: null }, { lastRunAt: { lt: new Date(now.getTime() - 55_000) } }] }, data: { lastRunAt: now } });
      if (!claimed.count) continue;
      const run = await this.prisma.jobRun.create({ data: { orgId: job.orgId, serviceId: job.serviceId, jobId: job.id, command: job.command, status: JobRunStatus.running, startedAt: now } });
      if (!this.agents.send(job.service.serverId, { type: 'RunCommand', runId: run.id, containerName: `berth-${job.serviceId}`, command: job.command })) {
        await this.prisma.jobRun.update({ where: { id: run.id }, data: { status: JobRunStatus.failed, output: 'Agent is offline', finishedAt: new Date() } });
      }
    }
  }

  private async assertService(orgId: string, id: string) {
    const service = await this.prisma.service.findFirst({ where: { id, orgId }, select: { serverId: true } });
    if (!service) throw new NotFoundException('Service not found');
    return service;
  }
}

function validateCron(expression: string, timezone: string): void {
  if (expression.trim().split(/\s+/).length !== 5) throw new BadRequestException('Cron must contain five fields');
  try { new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format(); } catch { throw new BadRequestException('Invalid timezone'); }
  cronMatches(expression, timezone, new Date());
}

function cronMatches(expression: string, timezone: string, date: Date): boolean {
  const parts = new Intl.DateTimeFormat('en-US', { timeZone: timezone, minute: 'numeric', hour: 'numeric', day: 'numeric', month: 'numeric', weekday: 'short', hourCycle: 'h23' }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const values = [Number(get('minute')), Number(get('hour')), Number(get('day')), Number(get('month')), weekday];
  const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 6]];
  return expression.trim().split(/\s+/).every((field, index) => matchField(field, values[index], ranges[index][0], ranges[index][1]));
}

function matchField(field: string, value: number, min: number, max: number): boolean {
  return field.split(',').some((part) => {
    const [range, stepRaw] = part.split('/');
    const step = stepRaw ? Number(stepRaw) : 1;
    if (!Number.isInteger(step) || step < 1) throw new BadRequestException('Invalid cron step');
    const [start, end] = range === '*' ? [min, max] : range.includes('-') ? range.split('-').map(Number) : [Number(range), Number(range)];
    if (!Number.isInteger(start) || !Number.isInteger(end) || start < min || end > max || start > end) throw new BadRequestException('Invalid cron field');
    return value >= start && value <= end && (value - start) % step === 0;
  });
}
