export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  publicPanelUrl: string;
  agentRepoUrl: string;
  jwtSecret: string;
  masterKey: string;
  github: {
    clientId: string;
    clientSecret: string;
    webhookSecret: string;
  };
  agentWsPort: number;
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  publicPanelUrl: process.env.BERTH_PUBLIC_PANEL_URL ?? '',
  agentRepoUrl: process.env.BERTH_AGENT_REPO_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-change-me',
  masterKey: process.env.BERTH_MASTER_KEY ?? 'dev-only-insecure-change-me',
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',
  },
  agentWsPort: Number(process.env.AGENT_WS_PORT ?? 4443),
});
