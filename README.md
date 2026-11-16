# Berth

**Self-hosted deployment panel for your own VPS.** The manageability of Railway/Render on infrastructure you own (OVH, Hetzner, any Ubuntu server).

Install a panel on your VPS, connect GitHub, and deploy apps, databases, and services with per-container resource limits, role-based team access, and CI/CD on push without giving up ownership of your servers.

```bash
curl -fsSL https://yassinos-coder.github.io/berth/install.sh | sudo bash
```

Then open `http://<your-server-ip>:3000`, create your admin account, connect GitHub, and berth your first service.

Documentation: https://yassinos-coder.github.io/berth/

---

## What it does

- **Deploy from GitHub** - push to deploy. Auto-detects Dockerfile, else builds with Nixpacks. Live build logs.
- **One-click services** - databases (Postgres, Redis, MySQL), object storage (MinIO), templates, or any Docker image.
- **Resource control** - set CPU cores, RAM, and priority (`cpu-shares`) per service.
- **Fleet management** - one panel manages many of your servers. Add a server with one command.
- **Teams & RBAC** - invite members with roles (`owner` / `admin` / `deployer` / `viewer`).
- **Automatic HTTPS** - built-in reverse proxy (Caddy) with Let's Encrypt for your app domains.
- **Yours** - runs entirely on your infrastructure. No phone-home, no license server.

## Architecture

Berth is a **self-hosted** system. Everything runs on *your* VPS:

```text
Your VPS (where you ran the install)
├── berth-agent   (Rust, native via systemd, runs as root)  <- the muscle: Docker, cgroups, proxy
├── berth-server  (NestJS API, Docker container)            <- the brain: auth, RBAC, orchestration
├── berth-ui      (React + Vite dashboard, Docker container)<- consumes the server API
├── postgres      (Docker container)                        <- panel state (source of truth)
└── docker        <- runs your deployed services

Additional servers you add later:
Another VPS -- berth-agent only --> dials back to your panel over WebSocket/mTLS
```

**Why the split:**
- The **agent** needs low-level host access (Docker, cgroups, reverse proxy) -> runs **native** as root.
- The **panel + Postgres** never touch the host - they delegate every privileged operation to the agent -> run as **containers** for trivial, atomic upgrades (`docker pull` + restart).

**Communication:** agents dial out to the panel (sidesteps NAT/firewalls) and hold a persistent WebSocket. The panel pushes **declarative desired state** (`Reconcile(ServiceSpec[])`); the agent makes Docker match it and streams logs/metrics/status back. Kubernetes-style reconciliation: self-healing, idempotent, survives reboots.

**Core abstraction:** everything you deploy is one `ServiceSpec`. A database, a GitHub app, a raw image, a template - all the same primitive with different fields filled in. See [docs/architecture.md](docs/architecture.md).

## Monorepo layout

```text
berth/
├── apps/
│   ├── berth-agent/   - Rust agent (native, per-server). Docker, WS/mTLS, reconciler, proxy.
│   ├── berth-server/  - NestJS control plane. Auth, RBAC, GitHub, webhooks, Postgres, agent channel.
│   └── berth-ui/      - React + Vite dashboard. Pure API consumer.
├── packages/
│   └── protocol/      - Shared panel<->agent message contract (ServiceSpec, Reconcile, events).
└── docs/
    └── architecture.md - Full design: topology, protocol, ServiceSpec, deploy loop, security.
```

## Tech stack

| Component | Stack |
|---|---|
| Agent | Rust - Tokio, Docker integration, `tokio-tungstenite`, Caddy |
| Panel API | NestJS (TypeScript) |
| UI | React + TypeScript |
| Panel DB | PostgreSQL |
| Builds | Dockerfile if present, else Nixpacks |
| Transport | WebSocket over mTLS, agent-initiated |

## V1 scope

Berth is currently in **alpha**, with a working platform architecture and real deployment workflows already in place. The immediate goal is not feature breadth; it is shipping a dependable, self-hosted deployment core that a user can trust in production.

### In scope for v1
- One-click deploys from GitHub and Docker images
- TLS + reverse proxy management for public domains
- Server onboarding and agent enrollment over mTLS
- RBAC for owners/admins/deployers/viewers
- Build logs, metrics, deploy history, and rollback-safe deploy flow
- Secret handling, environment variables, and service lifecycle management

### Explicitly out of scope for v1
- Multi-tenant SaaS hosting model
- Marketplace or plugin ecosystem
- Complex function runtime / serverless abstraction
- Broad feature sprawl beyond the self-hosted deployment core

### Release gates
Before calling the project production ready, we need:
- hardened rollback and recovery procedures
- explicit security rotation docs and runbooks
- practical migration/upgrade testing for agents and panel versions
- end-to-end smoke tests for deploy, proxy, and rollback flows

See [docs/roadmap-v1.md](docs/roadmap-v1.md), [docs/operations.md](docs/operations.md), and [SECURITY.md](SECURITY.md).

## Status

**Alpha — the product core is live and evolving.** The team is treating the next milestone as a hard production-readiness pass: reliable operations, safer deployments, and clearer supportability are as important as feature breadth.

## License

Source-available under the [Berth Personal Use License](LICENSE). Personal, non-commercial use only.
