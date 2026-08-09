import { Injectable } from '@nestjs/common';
import { BackupTarget } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class BackupTargetRepository {
  constructor(private readonly prisma: PrismaService) {}

  listByOrg(orgId: string): Promise<BackupTarget[]> {
    return this.prisma.backupTarget.findMany({
      where: { orgId },
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(orgId: string, id: string): Promise<BackupTarget | null> {
    return this.prisma.backupTarget.findFirst({ where: { id, orgId } });
  }

  create(data: {
    orgId: string;
    name: string;
    endpoint: string;
    bucket: string;
    region: string;
    accessKeyId: string;
    secretAccessKeyEncrypted: string;
  }): Promise<BackupTarget> {
    return this.prisma.backupTarget.create({ data });
  }

  async delete(orgId: string, id: string): Promise<boolean> {
    const result = await this.prisma.backupTarget.deleteMany({
      where: { id, orgId },
    });
    return result.count > 0;
  }
}
