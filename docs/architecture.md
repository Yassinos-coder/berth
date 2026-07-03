# Berth — Architecture

## Topology (self-hosted, per customer VPS)

```
Customer's VPS (where they ran the install)
├── berth-agent   (Rust, native/systemd, root)   ← Docker, cgroups, reverse proxy
├── berth-panel   (NestJS API + React UI, container)
├── postgres      (container)                     ← panel's source of truth
└── docker        ← runs the customer's deployed services (berths)

Additional servers:
Another VPS ── berth-agent only ──► dials back to panel over WebSocket/mTLS
```

Agents **dial out** to the panel (sidesteps NAT/firewalls). The panel holds a live handle per agent and pushes commands down it.

## Why native agent + containerized panel

- **Agent** needs privileged host access (Docker socket, cgroups, Caddy) → **native**, root, systemd.
- **Panel + Postgres** never touch the host; they delegate every privileged op to the agent → **containers**, for atomic upgrades (`docker pull` + restart). The access concern that motivates "native" simply doesn't apply to powerless components.

## Core abstraction: `ServiceSpec`

Every deployable thing is one spec. Every menu item is a pre-filled spec.

```typescript
interface ServiceSpec {
  id: string;
  name: string;
  serverId: string;                    // which agent runs it
  source: ServiceSource;
  env: EnvVar[];                       // secrets encrypted at rest
  ports: PortMapping[];
  volumes: VolumeMount[];
  resources: ResourceLimits;
  healthCheck?: HealthCheck;
  restartPolicy: 'no' | 'on-failure' | 'always' | 'unless-stopped';
  replicas: number;                    // 1 for v1
}

type ServiceSource =
  | { kind: 'image'; image: string; tag: string }
  | { kind: 'git'; repo: string; branch: string; build: BuildConfig };

interface BuildConfig {
  builder: 'auto' | 'nixpacks' | 'dockerfile';
  dockerfilePath?: string;
  buildArgs?: Record<string, string>;
  rootDirectory?: string;              // monorepo support
}

interface ResourceLimits {
  cpuCores: number;                    // Docker --cpus
  memoryMb: number;                    // Docker --memory
  cpuShares?: number;                  // Docker --cpu-shares → "priority"
  pidsLimit?: number;
}

interface PortMapping { containerPort: number; domain?: string; public: boolean }
interface VolumeMount { name: string; mountPath: string }
interface EnvVar { key: string; value: string; isSecret: boolean }
```

Menu item → spec mapping: Docker Image = `image` source · Database = image + volume + generated creds (template) · GitHub Repo = `git` source + build · Bucket = minio image + volume (template) · Template = spec factory (maybe multi-container) · Empty = blank · Function = deferred.

## Protocol (declarative reconciliation)

```typescript
type PanelToAgent =
  | { type: 'Reconcile'; services: ServiceSpec[] }   // desired state
  | { type: 'RemoveService'; serviceId: string }
  | { type: 'StreamLogs'; serviceId: string; follow: boolean }
  | { type: 'GetMetrics'; serviceId?: string };

type AgentToPanel =
  | { type: 'Enrolled'; agentId: string; serverSpecs: ServerSpecs }
  | { type: 'ServiceStatus'; serviceId: string; state: ServiceState; containerId?: string }
  | { type: 'BuildProgress'; serviceId: string; stage: string; logChunk: string }
  | { type: 'LogChunk'; serviceId: string; line: string; ts: number }
  | { type: 'Metrics'; serviceId: string; cpuPct: number; memMb: number }
  | { type: 'ReconcileResult'; applied: string[]; failed: FailedApply[] };

type ServiceState = 'building' | 'starting' | 'running' | 'unhealthy' | 'stopped' | 'crashed';
```

Agent reconcile loop:

```
on Reconcile(desired):
    actual = docker.list_containers(label berth.service_id)
    for spec in desired:
        if not running OR spec_hash changed:
            build if git-source → start new container → healthcheck → swap → stop old
    for container in actual not in desired:
        stop + remove
    report ServiceStatus for each
```

Containers labeled `berth.service_id` + `berth.spec_hash`. Unlabeled containers are never touched.

## Enrollment

1. User clicks "Add Server" → panel mints one-time, short-TTL bootstrap token.
2. UI shows `curl -sSL berth.sh/install | BOOTSTRAP=xxx sudo sh`.
3. Script installs agent binary + systemd unit.
4. Agent dials panel, presents bootstrap token.
5. Panel verifies → issues long-lived client cert + agent ID. Token burned.
6. All future connections use the cert (mTLS). Cert is revocable to kill a compromised server.

## Deploy loop

```
GitHub push → webhook to Nest (verify HMAC) → which app/agent?
  → Nest sends Reconcile with updated spec down the agent channel (+ short-lived scoped deploy token, NOT the raw GitHub PAT)
  → agent: clone → Dockerfile else Nixpacks → build (stream logs) → start new container with cpu/mem/priority
  → healthcheck passes → stop old container (zero-downtime) → ServiceStatus(running)
  → Nest records deployment history
```

## Security model

- Agent identity = revocable client cert (mTLS). Bootstrap tokens are single-use + short-lived.
- Secrets: envelope encryption in Postgres (per-secret data key wrapped by master key). Decrypted only when sent to agent.
- Agent gets short-lived scoped tokens for git clone — never raw GitHub credentials. Blast-radius control.
- Panel is unprivileged; only the native agent has host power.

## Build-first order (de-risk)

Prove the novel part first: Rust agent dials Nest over WS, runs a hardcoded `docker run hello-world`, streams output back to a `POST /servers/:id/exec`. Once command-down/logs-up round-trips, the rest (OAuth, RBAC, UI, Nixpacks, webhooks) is well-trodden work.
