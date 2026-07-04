import { Injectable } from '@nestjs/common';
import { EnvVar, Service } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ServiceWithEnv = Service & { envVars: EnvVar[] };

@Injectable()
export class ReconcileRepository {
  constructor(private readonly prisma: PrismaService) {}

  servicesForServer(serverId: string): Promise<ServiceWithEnv[]> {
    return this.prisma.service.findMany({
      where: { serverId },
      include: { envVars: true },
    });
  }

  async serverIdForService(serviceId: string): Promise<string | null> {
    const service = await this.prisma.service.findUnique({
      where: { id: serviceId },
      select: { serverId: true },
    });
    return service?.serverId ?? null;
  }
}
