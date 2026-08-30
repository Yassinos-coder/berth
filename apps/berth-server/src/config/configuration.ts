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
  localHostname: string;
  caCertPath: string;
  caKeyPath: string;
  github: {
    appId: string;
    appSlug: string;
    clientId: string;
    clientSecret: string;
    privateKey: string;
    webhookSecret: string;
  };
  agentWsPort: number;
}

function decodeGithubKey(): string {
  const b64 = process.env.GITHUB_APP_PRIVATE_KEY_B64;
  if (b64) return Buffer.from(b64, 'base64').toString('utf8');
  return process.env.GITHUB_APP_PRIVATE_KEY ?? '';
}

export default (): AppConfig => ({
  nodeEnv: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.BERTH_HTTP_PORT ?? 4000),
  databaseUrl: process.env.DATABASE_URL ?? '',
  publicPanelUrl: process.env.BERTH_PUBLIC_PANEL_URL ?? '',
  agentRepoUrl: process.env.BERTH_AGENT_REPO_URL ?? '',
  jwtSecret: process.env.JWT_SECRET ?? 'dev-only-insecure-change-me',
  masterKey: process.env.BERTH_MASTER_KEY ?? 'dev-only-insecure-change-me',
  corsOrigin: process.env.BERTH_CORS_ORIGIN ?? 'http://localhost:3000',
  localBootstrapToken: process.env.BERTH_LOCAL_BOOTSTRAP ?? '',
  localHostname: process.env.BERTH_LOCAL_HOSTNAME ?? '',
  caCertPath: process.env.BERTH_CA_CERT_PATH ?? './certs/ca.pem',
  caKeyPath: process.env.BERTH_CA_KEY_PATH ?? './certs/ca-key.pem',
  github: {
    appId: process.env.GITHUB_APP_ID ?? '',
    appSlug: process.env.GITHUB_APP_SLUG ?? '',
    clientId: process.env.GITHUB_CLIENT_ID ?? '',
    clientSecret: process.env.GITHUB_CLIENT_SECRET ?? '',
    privateKey: decodeGithubKey(),
    webhookSecret: process.env.GITHUB_WEBHOOK_SECRET ?? '',
  },
  agentWsPort: Number(process.env.AGENT_WS_PORT ?? 4443),
});
