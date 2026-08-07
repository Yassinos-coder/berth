import { Injectable } from '@nestjs/common';
import { GithubApp } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

export interface GithubAppRecord {
  appId: number;
  slug: string;
  clientId: string;
  clientSecret: string;
  webhookSecret: string;
  privateKey: string;
}

@Injectable()
export class GithubAppRepository {
  constructor(private readonly prisma: PrismaService) {}

  find(): Promise<GithubApp | null> {
    return this.prisma.githubApp.findFirst();
  }

  async upsert(record: GithubAppRecord): Promise<GithubApp> {
    const existing = await this.find();
    if (existing) {
      return this.prisma.githubApp.update({
        where: { id: existing.id },
        data: record,
      });
    }
    return this.prisma.githubApp.create({ data: record });
  }
}
