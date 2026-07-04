export interface AppConfig {
  nodeEnv: string;
  port: number;
  databaseUrl: string;
  publicPanelUrl: string;
  agentRepoUrl: string;
  jwtSecret: string;
  masterKey: string;
  corsOrigin: string;
  localBootstrapToken: string;
  caCertPath: string;
  caKeyPath: string;
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
  corsOrigin: process.env.BERTH_CORS_ORIGIN ?? 'http://localhost:3000',
  localBootstrapToken: process.env.BERTH_LOCAL_BOOTSTRAP ?? '',
  caCertPath: process.env.BERTH_CA_CERT_PATH ?? './certs/ca.pem',
  caKeyPath: process.env.BERTH_CA_KEY_PATH ?? './certs/ca-key.pem',
  github: {
    clientId: process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',
  },
  agentWsPort: Number(process.env.AGENT_WS_PORT ?? 4443),
});
