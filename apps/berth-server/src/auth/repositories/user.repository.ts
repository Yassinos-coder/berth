import { Injectable } from '@nestjs/common';
import { MemberStatus, Prisma, Role, User } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserRepository {
  constructor(private readonly prisma: PrismaService) {}

  count(): Promise<number> {
    return this.prisma.user.count();
  }

  findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { id } });
  }

  createOwnerWithOrg(data: {
    name: string;
    email: string;
    passwordHash: string;
    orgName: string;
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        passwordHash: data.passwordHash,
        role: Role.owner,
        org: { create: { name: data.orgName } },
      },
    });
  }

  touchLastActive(id: string): Promise<User> {
    return this.prisma.user.update({
      where: { id },
      data: { lastActiveAt: new Date() },
    });
  }

  create(data: Prisma.UserCreateInput): Promise<User> {
    return this.prisma.user.create({ data });
  }

  setTotpSecret(userId: string, encryptedSecret: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { totpSecret: encryptedSecret },
    });
  }

  enableTotp(userId: string, recoveryCodeHashes: string[]): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: true, recoveryCodeHashes },
    });
  }

  disableTotp(userId: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { totpEnabled: false, totpSecret: null, recoveryCodeHashes: [] },
    });
  }

  setRecoveryCodeHashes(userId: string, hashes: string[]): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { recoveryCodeHashes: hashes },
    });
  }

  setPasswordAndActivate(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, status: MemberStatus.active },
    });
  }

  updatePassword(userId: string, passwordHash: string): Promise<User> {
    return this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash },
    });
  }
}
