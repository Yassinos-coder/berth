# Berth — Project Context for Claude

This file is your memory of what Berth is and every architectural decision made so far. Read it fully before working. Global preferences in `~/.claude/CLAUDE.md` still apply (TypeScript conventions, no self-attribution in commits, never push without explicit approval, run `/changelog` before push, gitignore `package-lock.json`, etc.).

## What Berth is

A **self-hosted, open-source deployment panel** for your own VPS — the manageability of Railway/Render/Hostinger, but on infrastructure the user owns (OVH, Hetzner, any Ubuntu box). Install a panel on your VPS, connect GitHub, deploy apps/databases/services with per-container resource limits, RBAC teams, and CI/CD on push.

Onboarding: user buys a cheap VPS → `curl -sSL berth.sh | sudo bash` → opens `http://<server-ip>:3000` → creates admin account → connects GitHub → deploys.

## Settled decisions (do not relitigate without reason)

1. **Open source.** No license server, no phone-home, no license-key system. (Monetize later via managed cloud / team features — Coolify playbook. Business model deferred.)
2. **Self-hosted topology.** The panel runs on the *customer's* VPS, not hosted by us. One panel per customer manages many of *their* servers.
3. **Language split (pragmatic, not emotional):**
   - **Agent = Rust.** This is where Rust earns its keep: tiny static binary, safety for root-level Docker/cgroup access, great streaming.
   - **Panel API = NestJS/TypeScript.** The CRUD/OAuth/RBAC/webhooks 80% — fast to build in Nest.
   - **UI = React/TypeScript.** Data-heavy dashboard. NOT Rust (no Leptos).
   - Rejected: all-Rust stack (too slow for the integration-heavy 80%); all-TS (agent wants Rust's safety at root).
4. **Deployment of Berth's own components:**
   - `berth-agent` → **native**, systemd, runs as **root** (needs Docker, cgroups, reverse proxy). NOT containerized.
   - `berth-panel` (Nest+UI) + Postgres → **Docker containers**. They never touch the host (they delegate to the agent), so no access issue — and containers give trivial atomic upgrades (`docker pull` + restart). This was explicitly debated and decided.
5. **Transport:** agent **dials out** to the panel (sidesteps NAT/firewall; agents may be behind changing IPs) and holds a **persistent WebSocket over mTLS**. Chosen over gRPC for v1 (simpler in both Nest and Rust). Panel pushes commands down the live channel.
6. **Protocol is declarative (Kubernetes-style), not imperative.** Panel sends **desired state** `Reconcile(ServiceSpec[])`; agent diffs against actual Docker state and converges. Self-healing, idempotent, survives reboots. Postgres is the source of truth for desired state. NOT imperative Deploy/Stop/Restart commands.
7. **Enrollment:** one-time, short-TTL, single-use bootstrap token → agent exchanges it for a long-lived client cert (revocable). Bootstrap token burned after use.
8. **Builds:** Dockerfile if present, else **Nixpacks**. Don't build a build system from scratch. Build runs on the agent's server for v1.
9. **Reverse proxy:** agent runs **Caddy** (auto-HTTPS via Let's Encrypt) to route app domains → containers.

## Core abstraction: `ServiceSpec`

Everything deployable is ONE `ServiceSpec`. Every Railway-style menu item is just a pre-filled spec:
- **Docker Image** → `source.kind='image'`
- **Database (Redis/Postgres/MySQL)** → image + volume + generated-credential env. A *template*.
- **GitHub Repository** → `source.kind='git'` + build config (the full CI/CD loop)
- **Bucket** → `minio/minio` image + volume. A template.
- **Template** → factory that pre-fills a spec (possibly multi-container). NOT a separate feature.
- **Empty Service** → blank spec.
- **Function** → deferred (whole runtime problem, skip v1).

So "Templates" are just `ServiceSpec` factories. See `docs/architecture.md` for the full TypeScript shape (source, env, ports, volumes, resources{cpuCores, memoryMb, cpuShares}, healthCheck, restartPolicy, replicas).

Docker labels `berth.service_id` + `berth.spec_hash` let the agent know what it manages and whether a spec changed. Agent NEVER touches unlabeled containers (don't clobber the user's other stuff).

## Naming vocabulary

| Thing | Name |
|---|---|
| Product / panel | **Berth** |
| Rust agent | `berth-agent` |
| Install domain | `berth.sh` (available; `.io`/`.com`/`.dev` taken) |
| A deployed service | a **berth** ("spin up a new berth") |
| Container labels | `berth.service_id`, `berth.spec_hash` |
| Future CLI | `berth` (`berth deploy`, `berth logs`) |

## RBAC roles (v1)

owner (billing/delete org) · admin (manage servers/members) · deployer (deploy/restart/set limits) · viewer (read + logs). Enforced via Nest guards on mutations.

## Repo layout

```
apps/berth-agent/   — Rust: Tokio, bollard (Docker), tokio-tungstenite (WS), reconciler, Caddy mgmt
apps/berth-panel/   — NestJS: auth, RBAC, GitHub OAuth+webhooks, Postgres, agent WS channel
apps/berth-ui/      — React + TS dashboard
packages/protocol/  — shared panel⇄agent message contract (source of truth for both sides)
docs/architecture.md — full design
```

## Follow the global backend/frontend conventions from ~/.claude/CLAUDE.md

Nest: Controller→Service→Repository→DB. Interfaces in `interfaces/` folders (never inline, never `types/`). Validators in `validators/` folders. Utilities as static-method classes. Early returns. NestJS built-in exceptions. No comments/JSDoc. `@` import alias. Supabase repo pattern (schema/tableName class props) — note: Berth panel uses plain **PostgreSQL**, confirm ORM choice (Prisma vs TypeORM vs Supabase) before writing repos.

## Current status

**Pre-alpha — design complete, scaffolding started.** Nothing functional yet. Immediate next step discussed: the **v1 milestone plan**, ordered so the risky part (agent WebSocket round-trip: command down, logs up) is proven FIRST, before OAuth/RBAC/UI. A thin vertical slice — Rust agent dials Nest over WS, runs a hardcoded `docker run hello-world`, streams output back — kills 80% of the technical risk.

## Open questions to resolve before/while building

- ORM for the panel (Prisma vs TypeORM vs Supabase client) — global conventions assume Supabase but Berth is plain Postgres in a container.
- mTLS cert issuance mechanics (self-signed CA baked into panel? step-ca?).
- Monorepo tooling (pnpm workspaces + Cargo for the Rust app, or Nx/Turborepo).
- License choice (Apache-2.0 vs AGPL-3.0).
