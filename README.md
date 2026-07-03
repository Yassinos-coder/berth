# Berth

**Self-hosted deployment panel for your own VPS.** The manageability of Railway/Render on infrastructure you own (OVH, Hetzner, any Ubuntu server).

Install a panel on your VPS, connect GitHub, and deploy apps, databases, and services with per-container resource limits, role-based team access, and CI/CD on push without giving up ownership of your servers.

```bash
curl -sSL berth.sh | sudo bash
```

Then open `http://<your-server-ip>:3000`, create your admin account, connect GitHub, and berth your first service.

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

## Status

**Pre-alpha.** The backend, UI, and agent scaffolding are in active development.

## License

Source-available under the [Berth Personal Use License](LICENSE). Personal, non-commercial use only.
