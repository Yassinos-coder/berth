import { PrismaClient, Role } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const existing = await prisma.user.count();
  if (existing > 0) {
    console.log('[seed] users already exist - skipping.');
    return;
  }

  const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@berth.local';
  const password = process.env.SEED_ADMIN_PASSWORD ?? 'berthadmin';

  const passwordHash = await argon2.hash(password);
  const user = await prisma.user.create({
    data: {
      name: 'Berth Admin',
      email,
      passwordHash,
      role: Role.owner,
      org: { create: { name: 'Berth' } },
    },
  });

  console.log(`[seed] created owner ${user.email} (password: ${password})`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
