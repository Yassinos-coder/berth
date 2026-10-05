import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import type { BerthApiClient } from '@/api/berth-api.client';
import type { ServiceAction } from '@/interfaces';
import { FormatUtil } from '@/utils/format.util';

const DEFAULT_LOG_LINES = 100;
const MAX_LOG_LINES = 500;

const asText = (value: unknown) => ({
  content: [
    { type: 'text' as const, text: typeof value === 'string' ? value : JSON.stringify(value, null, 2) },
  ],
});

const asError = (error: unknown) => ({
  isError: true,
  content: [{ type: 'text' as const, text: error instanceof Error ? error.message : String(error) }],
});

export class BerthMcpServer {
  constructor(private readonly api: BerthApiClient) {}

  async serve(): Promise<void> {
    const server = new McpServer({ name: 'berth', version: '0.13.0' });
    this.register(server);
    await server.connect(new StdioServerTransport());
  }

  register(server: McpServer): void {
    server.registerTool(
      'list_services',
      { description: 'List every service with its state, server, source and domain.' },
      async () => this.run(async () => this.api.listServices()),
    );

    server.registerTool(
      'get_logs',
      {
        description: 'Fetch recent log lines for a service. Use build=true for the latest build output.',
        inputSchema: {
          service: z.string().describe('Service name or id'),
          build: z.boolean().optional(),
          lines: z.number().int().min(1).max(MAX_LOG_LINES).optional(),
        },
      },
      async ({ service, build, lines }) =>
        this.run(async () => {
          const target = await this.api.findService(service);
          const all = await this.api.logs(target.id);
          const selected = all.filter((entry) => (build ? entry.stream === 'build' : entry.stream !== 'build'));
          return selected
            .slice(-(lines ?? DEFAULT_LOG_LINES))
            .map((entry) => FormatUtil.cleanLog(entry.line))
            .join('\n');
        }),
    );

    server.registerTool(
      'list_deployments',
      {
        description: 'List recent deployments, optionally for one service.',
        inputSchema: { service: z.string().optional() },
      },
      async ({ service }) =>
        this.run(async () => {
          const target = service ? await this.api.findService(service) : undefined;
          return this.api.deployments(target?.id);
        }),
    );

    server.registerTool(
      'get_env',
      {
        description: 'List a service\'s environment variables. Secret values are masked.',
        inputSchema: { service: z.string() },
      },
      async ({ service }) =>
        this.run(async () => {
          const target = await this.api.findService(service);
          return FormatUtil.maskSecrets(await this.api.env(target.id));
        }),
    );

    this.registerAction(server, 'restart_service', 'restart', 'Restart a service.');
    this.registerAction(server, 'redeploy_service', 'redeploy', 'Rebuild and redeploy a service.');
    this.registerAction(server, 'start_service', 'start', 'Start a stopped service.');
    this.registerAction(server, 'stop_service', 'stop', 'Stop a running service.');

    server.registerTool(
      'rollback_deployment',
      {
        description: 'Roll a service back to a previous deployment by deployment id.',
        inputSchema: { deploymentId: z.string() },
      },
      async ({ deploymentId }) => this.run(async () => this.api.rollback(deploymentId)),
    );
  }

  private registerAction(
    server: McpServer,
    tool: string,
    action: ServiceAction,
    description: string,
  ): void {
    server.registerTool(
      tool,
      { description, inputSchema: { service: z.string().describe('Service name or id') } },
      async ({ service }) =>
        this.run(async () => {
          const target = await this.api.findService(service);
          await this.api.serviceAction(target.id, action);
          return `${action} requested for ${target.name}`;
        }),
    );
  }

  private async run(work: () => Promise<unknown>) {
    try {
      return asText(await work());
    } catch (error) {
      return asError(error);
    }
  }
}
