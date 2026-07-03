import { Injectable } from '@nestjs/common';
import { MemberStatus, Role, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class MemberRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: { orgId },
      orderBy: { createdAt: 'asc' },
    });
  }

  findInOrg(orgId: string, id: string): Promise<User | null> {
    return this.prisma.user.findFirst({ where: { id, orgId } });
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  invite(data: {
    orgId: string;
    email: string;
    name: string;
    role: Role;
    passwordHash: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        orgId: data.orgId,
        email: data.email,
        name: data.name,
        role: data.role,
        passwordHash: data.passwordHash,
        status: MemberStatus.invited,
      },
    });
  }

  updateRole(orgId: string, id: string, role: Role): Promise<User> {
    return this.prisma.user.update({ where: { id }, data: { role } });
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const result = await this.prisma.user.deleteMany({ where: { id, orgId } });
    return result.count > 0;
  }
}
