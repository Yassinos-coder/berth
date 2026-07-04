import {
  AgentStatus,
  PrismaClient,
  ServiceKind,
  ServiceState,
  SourceKind,
} from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: 'asc' },
  });
  if (!org) {
    throw new Error(
      'No organization found — create an admin via /setup (or run db:seed) first.',
    );
  }

  const hostname = process.env.BERTH_LOCAL_HOSTNAME ?? 'dev-local';
  const token = randomBytes(24).toString('hex');

  await prisma.server.deleteMany({ where: { orgId: org.id, name: hostname } });

  const server = await prisma.server.create({
    data: {
      orgId: org.id,
      name: hostname,
      region: 'Local (dev)',
      isLocal: true,
      status: AgentStatus.enrolling,
      bootstrapToken: token,
      bootstrapExpires: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    },
  });

  await prisma.service.create({
    data: {
      orgId: org.id,
      serverId: server.id,
      name: 'demo-nginx',
      kind: ServiceKind.image,
      state: ServiceState.starting,
      sourceKind: SourceKind.image,
      image: 'nginx',
      tag: 'alpine',
      cpuCores: 0.5,
      memoryMb: 128,
      replicas: 1,
    },
  });

  const caPath = resolve(process.env.BERTH_CA_CERT_PATH ?? './certs/ca.pem');
  const stateDir = resolve('./.agent-state');
  const agentBin = resolve('../berth-agent/target/release/berth-agent');

  console.log('\n✅ Local server + demo-nginx service created.\n');
  console.log(`   server : ${server.name} (${server.id})`);
  console.log(`   token  : ${token}\n`);
  console.log('1) Make sure the panel is running (pnpm --filter @berth/server start)');
  console.log('2) Run the agent:\n');
  console.log(
    `   BERTH_PANEL_URL=wss://localhost:4443 BERTH_BOOTSTRAP=${token} \\\n` +
      `   BERTH_CA_CERT_PATH="${caPath}" BERTH_STATE_DIR="${stateDir}" \\\n` +
      `   BERTH_AGENT_ID=${hostname} "${agentBin}" run\n`,
  );
  console.log('3) Watch it converge:  docker ps --filter label=berth.managed=true\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
