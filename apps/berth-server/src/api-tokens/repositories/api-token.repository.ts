import { Injectable } from '@nestjs/common';
import { ApiToken, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type ApiTokenWithUser = ApiToken & { user: User };

@Injectable()
export class ApiTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  listForUser(orgId: string, userId: string): Promise<ApiToken[]> {
    return this.prisma.apiToken.findMany({
      where: { orgId, userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findByHash(tokenHash: string): Promise<ApiTokenWithUser | null> {
    return this.prisma.apiToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });
  }

  create(data: {
    orgId: string;
    userId: string;
    name: string;
    tokenHash: string;
    tokenPrefix: string;
    expiresAt: Date | null;
  }): Promise<ApiToken> {
    return this.prisma.apiToken.create({ data });
  }

  touchLastUsed(id: string): Promise<ApiToken> {
    return this.prisma.apiToken.update({
      where: { id },
      data: { lastUsedAt: new Date() },
    });
  }

  async delete(orgId: string, userId: string, id: string): Promise<boolean> {
    const result = await this.prisma.apiToken.deleteMany({
      where: { id, orgId, userId },
    });
    return result.count > 0;
  }
}
