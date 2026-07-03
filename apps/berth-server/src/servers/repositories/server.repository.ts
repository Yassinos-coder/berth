import { Injectable } from '@nestjs/common';
import { Server } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

type ServerWithCount = Server & { _count: { services: number } };

@Injectable()
export class ServerRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<ServerWithCount[]> {
    return this.prisma.server.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { services: true } } },
    });
  }

  findById(orgId: string, id: string): Promise<ServerWithCount | null> {
    return this.prisma.server.findFirst({
      where: { id, orgId },
      include: { _count: { select: { services: true } } },
    });
  }

  createEnrolling(data: {
    orgId: string;
    name: string;
    bootstrapToken: string;
    bootstrapExpires: Date;
  }): Promise<Server> {
    return this.prisma.server.create({
      data: {
        orgId: data.orgId,
        name: data.name,
        bootstrapToken: data.bootstrapToken,
        bootstrapExpires: data.bootstrapExpires,
      },
    });
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const result = await this.prisma.server.deleteMany({
      where: { id, orgId },
    });
    return result.count > 0;
  }
}
