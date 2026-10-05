import { Command } from 'commander';
import { BerthApiClient } from '@/api/berth-api.client';
import { ConfigStore } from '@/config/config-store';
import type { LogLine, ServiceAction } from '@/interfaces';
import { BerthMcpServer } from '@/mcp/berth-mcp.server';
import { ShellSession } from '@/shell/shell-session';
import { FormatUtil } from '@/utils/format.util';

const FOLLOW_INTERVAL_MS = 2000;
const DEFAULT_LOG_LINES = 100;
const SEEN_LIMIT = 5000;

const client = () => new BerthApiClient(ConfigStore.load());

const program = new Command();
program.name('berth').description('Manage your Berth panel from the terminal').version('0.13.0');

program
  .command('login')
  .description('Save the panel URL and an API token')
  .requiredOption('--url <url>', 'Panel URL, e.g. https://panel.example.com')
  .requiredOption('--token <token>', 'Personal API token (berth_...)')
  .action(async (options: { url: string; token: string }) => {
    const config = { url: FormatUtil.normalizeUrl(options.url), token: options.token.trim() };
    const services = await new BerthApiClient(config).listServices();
    ConfigStore.save(config);
    console.log(`Logged in to ${config.url} (${services.length} services). Saved to ${ConfigStore.path()}`);
  });

program
  .command('services')
  .alias('ls')
  .description('List services')
  .action(async () => {
    const services = await client().listServices();
    if (services.length === 0) return console.log('No services yet.');
    console.log(
      FormatUtil.table(
        ['NAME', 'STATE', 'SERVER', 'SOURCE', 'DOMAIN'],
        services.map((service) => [
          service.name,
          service.state,
          service.serverName,
          service.source.kind === 'git'
            ? `${service.source.repo}@${service.source.branch}`
            : `${service.source.image}:${service.source.tag}`,
          service.domain ?? '',
        ]),
      ),
    );
  });

const ACTIONS: { name: ServiceAction; description: string }[] = [
  { name: 'redeploy', description: 'Rebuild and redeploy a service' },
  { name: 'restart', description: 'Restart a service' },
  { name: 'start', description: 'Start a stopped service' },
  { name: 'stop', description: 'Stop a running service' },
];

for (const action of ACTIONS) {
  program
    .command(`${action.name === 'redeploy' ? 'deploy' : action.name} <service>`)
    .description(action.description)
    .action(async (reference: string) => {
      const api = client();
      const service = await api.findService(reference);
      await api.serviceAction(service.id, action.name);
      console.log(`${action.name} requested for ${service.name}`);
    });
}

program
  .command('logs <service>')
  .description('Show service logs')
  .option('-b, --build', 'show build output instead of runtime logs')
  .option('-n, --lines <count>', 'number of lines to show', String(DEFAULT_LOG_LINES))
  .option('-f, --follow', 'keep streaming new lines')
  .action(async (reference: string, options: { build?: boolean; lines: string; follow?: boolean }) => {
    const api = client();
    const service = await api.findService(reference);
    const wanted = (entry: LogLine) => (options.build ? entry.stream === 'build' : entry.stream !== 'build');
    const count = Math.max(1, Number.parseInt(options.lines, 10) || DEFAULT_LOG_LINES);

    const seen = new Set<string>();
    const print = (entries: LogLine[]) => {
      for (const entry of entries) {
        if (seen.has(entry.id)) continue;
        seen.add(entry.id);
        console.log(FormatUtil.cleanLog(entry.line));
      }
      if (seen.size > SEEN_LIMIT) seen.clear();
    };

    print((await api.logs(service.id)).filter(wanted).slice(-count));
    if (!options.follow) return;
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, FOLLOW_INTERVAL_MS));
      print((await api.logs(service.id)).filter(wanted));
    }
  });

program
  .command('deployments [service]')
  .description('List recent deployments')
  .action(async (reference?: string) => {
    const api = client();
    const service = reference ? await api.findService(reference) : undefined;
    const deployments = await api.deployments(service?.id);
    if (deployments.length === 0) return console.log('No deployments.');
    console.log(
      FormatUtil.table(
        ['ID', 'SERVICE', 'STATUS', 'TRIGGER', 'COMMIT', 'CREATED'],
        deployments.map((deployment) => [
          deployment.id,
          deployment.serviceName ?? deployment.serviceId,
          deployment.status,
          deployment.trigger ?? '',
          deployment.commitSha?.slice(0, 7) ?? '',
          deployment.createdAt,
        ]),
      ),
    );
  });

program
  .command('rollback <deploymentId>')
  .description('Roll back to a previous deployment')
  .action(async (deploymentId: string) => {
    await client().rollback(deploymentId);
    console.log(`Rollback to ${deploymentId} requested`);
  });

const env = program.command('env').description('Read and change service variables');

env
  .command('get <service>')
  .description('Print variables (secrets are masked unless --reveal)')
  .option('--reveal', 'show secret values')
  .action(async (reference: string, options: { reveal?: boolean }) => {
    const api = client();
    const service = await api.findService(reference);
    const entries = await api.env(service.id);
    for (const entry of options.reveal ? entries : FormatUtil.maskSecrets(entries)) {
      console.log(`${entry.key}=${entry.value}`);
    }
  });

env
  .command('set <service> <assignments...>')
  .description('Set KEY=value pairs (redeploy to apply)')
  .option('--secret', 'store the values as secrets')
  .action(async (reference: string, assignments: string[], options: { secret?: boolean }) => {
    const api = client();
    const service = await api.findService(reference);
    const current = await api.env(service.id);
    const merged = new Map(current.map((entry) => [entry.key, entry]));
    for (const assignment of assignments) {
      const { key, value } = FormatUtil.parseAssignment(assignment);
      merged.set(key, { key, value, isSecret: options.secret ?? merged.get(key)?.isSecret ?? false });
    }
    await api.setEnv(service.id, [...merged.values()]);
    console.log(`Updated ${assignments.length} variable(s) on ${service.name}. Redeploy to apply.`);
  });

env
  .command('unset <service> <keys...>')
  .description('Remove variables (redeploy to apply)')
  .action(async (reference: string, keys: string[]) => {
    const api = client();
    const service = await api.findService(reference);
    const remaining = (await api.env(service.id)).filter((entry) => !keys.includes(entry.key));
    await api.setEnv(service.id, remaining);
    console.log(`Removed ${keys.length} variable(s) from ${service.name}. Redeploy to apply.`);
  });

program
  .command('shell <service>')
  .description('Open an interactive shell in a running service')
  .action(async (reference: string) => {
    const config = ConfigStore.load();
    const service = await new BerthApiClient(config).findService(reference);
    await ShellSession.open(config, service.id);
  });

program
  .command('mcp')
  .description('Run an MCP server over stdio for AI assistants')
  .action(async () => {
    await new BerthMcpServer(client()).serve();
  });

program.parseAsync().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
