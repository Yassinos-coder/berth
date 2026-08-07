import { Injectable } from '@nestjs/common';
import { GithubInstallation } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GithubInstallationRepository {
  constructor(private readonly prisma: PrismaService) {}

  findByOrg(orgId: string): Promise<GithubInstallation | null> {
    return this.prisma.githubInstallation.findUnique({ where: { orgId } });
  }

  findByInstallationId(
    installationId: number,
  ): Promise<GithubInstallation | null> {
    return this.prisma.githubInstallation.findUnique({
      where: { installationId },
    });
  }

  upsert(
    orgId: string,
    installationId: number,
    accountLogin: string,
  ): Promise<GithubInstallation> {
    return this.prisma.githubInstallation.upsert({
      where: { orgId },
      create: { orgId, installationId, accountLogin },
      update: { installationId, accountLogin },
    });
  }

  async deleteByInstallationId(installationId: number): Promise<void> {
    await this.prisma.githubInstallation.deleteMany({
      where: { installationId },
    });
  }
}
