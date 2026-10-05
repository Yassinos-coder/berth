import type { Page, Route } from '@playwright/test';

export const USER = { id: 'u1', name: 'Ada Admin', email: 'ada@example.com', role: 'owner' };

export const SERVER = {
  id: 'srv1',
  name: 'edge-1',
  status: 'online',
  ip: '203.0.113.7',
  region: 'eu',
  os: 'Ubuntu 24.04',
  agentVersion: '0.14.0',
  cpuCores: 4,
  memoryMb: 8192,
  diskGb: 80,
  serviceCount: 2,
  usage: { cpuPct: 12, memPct: 30, diskGb: 20, diskTotalGb: 80 },
  lastSeen: new Date().toISOString(),
  createdAt: new Date().toISOString(),
};

export const GIT_SERVICE = {
  id: 'svc-web',
  name: 'storefront',
  kind: 'git',
  state: 'running',
  serverId: 'srv1',
  serverName: 'edge-1',
  source: {
    kind: 'git',
    repo: 'acme/storefront',
    branch: 'main',
    build: { builder: 'auto' },
  },
  resources: { cpuCores: 1, memoryMb: 512 },
  replicas: 1,
  internalDomains: ['storefront-abc.berth.local'],
  previewsEnabled: false,
  usage: { cpuPct: 4, memPct: 20, memMb: 120 },
  createdAt: new Date().toISOString(),
};

export const DB_SERVICE = {
  ...GIT_SERVICE,
  id: 'svc-db',
  name: 'orders-db',
  kind: 'database',
  templateKind: 'postgres',
  source: { kind: 'image', image: 'postgres', tag: '16-alpine' },
};

export const TEMPLATES = [
  { id: 'tpl_postgres', name: 'PostgreSQL', description: 'Managed Postgres.', category: 'database', icon: 'Database', accent: '#3E6FB0', official: true, kind: 'postgres', app: false },
  { id: 'tpl_redis', name: 'Redis', description: 'In-memory cache.', category: 'cache', icon: 'Zap', accent: '#D64B3C', official: true, kind: 'redis', app: false },
  { id: 'tpl_n8n', name: 'n8n', description: 'Workflow automation.', category: 'app', icon: 'Workflow', accent: '#EA4B71', official: true, kind: 'n8n', app: true },
  { id: 'tpl_grafana', name: 'Grafana', description: 'Dashboards.', category: 'tooling', icon: 'LineChart', accent: '#F46800', official: true, kind: 'grafana', app: true },
];

export const LOGS = [
  { id: '1', ts: 1_000, stream: 'stdout', line: 'server listening on :3000' },
  { id: '2', ts: 2_000, stream: 'build', line: '==> Build started' },
  { id: '3', ts: 3_000, stream: 'build', line: '==> Building with Dockerfile' },
];

export interface ApiCall {
  method: string;
  path: string;
  search: string;
  body: unknown;
}

export interface MockOptions {
  authenticated?: boolean;
  services?: unknown[];
  githubConnected?: boolean;
  proxyHosts?: unknown[];
  channels?: unknown[];
  role?: string;
  environments?: unknown[];
  alertSettings?: Record<string, unknown>;
  deployments?: unknown[];
  logs?: unknown[];
  dns?: { status: string; message: string; resolved?: string[]; expectedIp?: string };
}

const json = (route: Route, body: unknown, status = 200) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

export async function mockApi(page: Page, options: MockOptions = {}): Promise<ApiCall[]> {
  const {
    authenticated = true,
    services = [GIT_SERVICE, DB_SERVICE],
    githubConnected = false,
    proxyHosts = [],
    channels = [],
    role = 'owner',
    environments = [],
    alertSettings = { enabled: true, cpuPct: 90, memPct: 90, diskPct: 90, minutes: 5 },
    deployments = [],
    logs = LOGS,
    dns = { status: 'ok', message: 'app.example.com points to this server.', resolved: ['203.0.113.7'], expectedIp: '203.0.113.7' },
  } = options;
  const calls: ApiCall[] = [];

  await page.route('**/api/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname.replace(/^\/api/, '');
    const method = request.method();
    let body: unknown = null;
    try {
      body = request.postDataJSON();
    } catch {
      body = null;
    }
    calls.push({ method, path, search: url.search, body });

    if (path === '/auth/me') {
      return authenticated ? json(route, { ...USER, role }) : json(route, { message: 'Unauthorized' }, 401);
    }
    if (path === '/auth/setup-state') return json(route, { needsSetup: false });
    if (path === '/environments' && method === 'GET') return json(route, environments);
    if (path === '/environments' && method === 'POST') return json(route, { id: 'env-new', ...(body as object) });
    if (path.startsWith('/environments/assign/') && method === 'PATCH') return json(route, { ok: true });
    if (path === '/alert-settings' && method === 'GET') return json(route, alertSettings);
    if (path === '/alert-settings' && method === 'PATCH') return json(route, { ...alertSettings, ...(body as object) });
    if (path === '/templates') return json(route, TEMPLATES);
    if (path === '/servers') return json(route, [SERVER]);
    if (path === '/services' && method === 'GET') return json(route, services);

    const service = (services as { id: string }[]).find((item) => path === `/services/${item.id}`);
    if (service && method === 'GET') return json(route, service);
    if (service && method === 'PATCH') {
      return json(route, { ...service, ...(body as object) });
    }

    if (/^\/services\/[^/]+\/logs$/.test(path)) return json(route, logs);
    if (/^\/services\/[^/]+\/metrics\/peak$/.test(path)) return json(route, { cpuPct: 10, memMb: 200 });
    if (/^\/services\/[^/]+\/metrics(\/history)?$/.test(path)) {
      return json(route, [
        { ts: 1_000, cpuPct: 5, memMb: 100, netRxMb: 1, netTxMb: 1 },
        { ts: 2_000, cpuPct: 15, memMb: 150, netRxMb: 2, netTxMb: 2 },
      ]);
    }
    if (/^\/services\/[^/]+\/env$/.test(path)) return json(route, []);
    if (/^\/services\/[^/]+\/connection$/.test(path)) {
      return json(route, { available: false, publicNetworking: false, variables: [] });
    }
    if (path === '/github/tree') return json(route, { directories: [], dockerfiles: [], monorepoMarkers: [] });
    if (path === '/github/status') return json(route, { configured: githubConnected, connected: githubConnected });
    if (path === '/dashboard/stats') {
      return json(route, { servers: 1, serversOnline: 1, services: services.length, servicesRunning: services.length, deploymentsToday: 0, avgCpuPct: 5, avgMemPct: 20 });
    }
    if (path === '/notification-channels') return json(route, channels);
    if (path === '/system/version') return json(route, { current: '0.14.0', latest: '0.14.0', updateAvailable: false });
    if (path === '/deployments') return json(route, deployments);
    if (path === '/proxy-hosts/dns-check') return json(route, { domain: url.searchParams.get('domain'), resolved: [], ...dns });
    if (path === '/proxy-hosts') return json(route, proxyHosts);

    if (method === 'GET') return json(route, []);
    return json(route, {});
  });

  return calls;
}
