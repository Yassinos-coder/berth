import { PrismaPg } from '@prisma/adapter-pg';
import type { Prisma } from '@prisma/client';

export class PrismaClientFactory {
  static options(): Prisma.PrismaClientOptions {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not set');
    }
    return { adapter: new PrismaPg({ connectionString }) };
  }
}
