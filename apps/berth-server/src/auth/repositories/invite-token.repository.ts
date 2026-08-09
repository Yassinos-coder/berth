import { Injectable } from '@nestjs/common';
import { InviteToken, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export type InviteTokenWithUser = InviteToken & { user: User };

@Injectable()
export class InviteTokenRepository {
  constructor(private readonly prisma: PrismaService) {}

  async replace(
    userId: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.prisma.inviteToken.deleteMany({ where: { userId } });
    await this.prisma.inviteToken.create({
      data: { userId, tokenHash, expiresAt },
    });
  }

  findValidByHash(tokenHash: string): Promise<InviteTokenWithUser | null> {
    return this.prisma.inviteToken.findFirst({
      where: { tokenHash, expiresAt: { gt: new Date() } },
      include: { user: true },
    });
  }

  async delete(userId: string): Promise<void> {
    await this.prisma.inviteToken.deleteMany({ where: { userId } });
  }
}
