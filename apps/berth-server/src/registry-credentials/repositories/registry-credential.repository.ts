import { Injectable } from '@nestjs/common';
import { RegistryCredential } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class RegistryCredentialRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<RegistryCredential[]> {
    return this.prisma.registryCredential.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(orgId: string, id: string): Promise<RegistryCredential | null> {
    return this.prisma.registryCredential.findFirst({
      where: { id, orgId },
    });
  }

  create(data: {
    orgId: string;
    name: string;
    server: string;
    username: string;
    passwordEncrypted: string;
  }): Promise<RegistryCredential> {
    return this.prisma.registryCredential.create({ data });
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const result = await this.prisma.registryCredential.deleteMany({
      where: { id, orgId },
    });
    return result.count > 0;
  }
}
