import { Injectable } from '@nestjs/common';
import { Session } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class SessionRepository {
  constructor(private readonly prisma: PrismaService) {}

  create(data: {
    orgId: string;
    userId: string;
    userAgent: string;
    ip: string;
  }): Promise<Session> {
    return this.prisma.session.create({ data });
  }

  findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({ where: { id } });
  }

  listForUser(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastSeenAt: 'desc' },
    });
  }

  touchLastSeen(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { lastSeenAt: new Date() },
    });
  }

  async delete(userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.session.deleteMany({
      where: { id, userId },
    });
    return result.count > 0;
  }

  async deleteAllExcept(userId: string, exceptId: string): Promise<number> {
    const result = await this.prisma.session.deleteMany({
      where: { userId, NOT: { id: exceptId } },
    });
    return result.count;
  }

  async deleteAll(userId: string): Promise<number> {
    const result = await this.prisma.session.deleteMany({ where: { userId } });
    return result.count;
  }
}
