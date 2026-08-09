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
   - `berth-server` (NestJS) + `berth-ui` (React/Vite) + Postgres → **Docker containers**. They never touch the host (they delegate to the agent), so no access issue — and containers give trivial atomic upgrades (`docker pull` + restart). This was explicitly debated and decided.
5. **Transport:** agent **dials out** to the panel (sidesteps NAT/firewall; agents may be behind changing IPs) and holds a **persistent WebSocket over mTLS**. Chosen over gRPC for v1 (simpler in both Nest and Rust). Panel pushes commands down the live channel.
6. **Protocol is declarative (Kubernetes-style), not imperative.** Panel sends **desired state** `Reconcile(ServiceSpec[])`; agent diffs against actual Docker state and converges. Self-healing, idempotent, survives reboots. Postgres is the source of truth for desired state. NOT imperative Deploy/Stop/Restart commands.
7. **Enrollment:** one-time, short-TTL, single-use bootstrap token → agent exchanges it for a long-lived client cert (revocable). Bootstrap token burned after use.
8. **Builds:** Dockerfile if present, else **Nixpacks**. Don't build a build system from scratch. Build runs on the agent's server for v1.
9. **Reverse proxy:** agent runs **Caddy** (auto-HTTPS via Let's Encrypt) to route app domains → containers.
10. **ORM = Prisma** (plain Postgres, NOT Supabase). Berth is self-hosted, so the DB is a **local Postgres container** co-located with the panel on the customer's VPS — no hosted/Supabase dependency (would violate the no-phone-home principle). The Supabase repository pattern from the global conventions does NOT apply here: no Supabase client, no `.maybeSingle()`, no `schema`/`tableName` props. Keep the Controller→Service→Repository shape, but repositories wrap the Prisma client and talk to local Postgres. Prisma owns migrations + the generated typed client.

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
apps/berth-server/  — NestJS: auth, RBAC, GitHub OAuth+webhooks, Postgres (Prisma), agent WS channel
apps/berth-ui/      — React + TS dashboard (Vite, shadcn/ui, Tailwind CSS v4)
packages/protocol/  — shared panel⇄agent message contract (source of truth for both sides)
docs/architecture.md — full design
```

## Follow the global backend/frontend conventions from ~/.claude/CLAUDE.md

Nest: Controller→Service→Repository→DB. Interfaces in `interfaces/` folders (never inline, never `types/`). Validators in `validators/` folders. Utilities as static-method classes. Early returns. NestJS built-in exceptions. No comments/JSDoc. `@` import alias. **Berth panel uses plain PostgreSQL via Prisma** (settled decision #10) — repositories wrap the Prisma client. Ignore the Supabase repo pattern (schema/tableName class props) from the global conventions; it does not apply here.

**API protection = `nestjs-shield`** (our own package, `yassinoscoder`) — NOT `@nestjs/throttler`. Covers rate limiting, IP allow/block lists, auto-ban, slow-down, UA filtering, burst caps, and payload limits, with pluggable memory/Redis storage. Guards the public panel surface: admin login (auto-ban + slow-down on repeated failures), GitHub webhook receiver, and the agent-facing endpoints.

## Current status

**Alpha — full vertical stack built, running on a real VPS.** UI (all screens), NestJS panel (auth, RBAC, all feature modules, Prisma/Postgres), and the Rust agent (Docker reconciler, host specs) are implemented. The **agent↔panel mTLS WebSocket round-trip is proven on real hardware** (OVH Ubuntu VPS): agent dials the panel `agent-gateway` over TLS, enrolls via CSR, reconnects with a client cert (mTLS), and the panel pushes `Reconcile(ServiceSpec[])` down the live channel. Security hardening (Phase C) and a zero-touch panel installer (Phase D) are in place.

**GitHub push-to-deploy is built (v0.6–0.8).** GitHub App integration via the **one-click App Manifest flow** (Settings → Create GitHub App — auto-registers a per-instance App and stores App id/private key/webhook secret encrypted in a `GithubApp` table, DB-first with env fallback); installation-scoped repo/branch pickers; HMAC-verified push webhooks that queue a deployment and reconcile; and **agent git builds** (shallow clone with a short-lived installation token → Dockerfile if present else Nixpacks → run), with **Railway-style build config** (root directory, build command, start command → Nixpacks `--build-cmd`/`--start-cmd`) editable per service. Servers have a **Regenerate token** action for re-enrollment, and the installer self-heals a stale agent cert after a panel reinstall.

**Reverse proxy & TLS is built (v0.9.0).** The agent runs a managed **Caddy** container on the `berth` network (ports 80/443, cert volume `berth-caddy-data`); a **Proxy Hosts** panel screen maps a domain → a service with automatic HTTPS (Let's Encrypt), HTTP/2/3, and force-HTTPS. `ProxyHost` records flow to the agent via `Reconcile.proxies`; the agent regenerates the full Caddy config each reconcile and `caddy reload`s it, proxying to services by stable container name.

**Bucket SFTP access is built (v0.10.2).** `ServiceSpec` carries an optional `templateKind` so the agent can recognize `bucket` (MinIO) services. The agent runs a second managed container, **`berth-sftpgo`** (`drakkan/sftpgo`, port 2022 only — no legacy FTP, since passive-mode FTP needs a large published port range that doesn't fit the current per-container model), and syncs one SFTPGo user per bucket via its REST API (`GET /token` → bearer auth → `PUT/POST/DELETE /users`), each backed by that bucket's own MinIO instance as an S3 filesystem. The agent also creates the bucket itself inside each MinIO instance on reconcile (`minio/mc mb --ignore-existing`, one-shot container) since a fresh `minio/minio` server has no buckets by default. SFTPGo's own admin credentials are generated once and persisted at `/var/lib/berth/sftpgo/admin.secret` — stable across agent restarts, never sent to the panel. The SFTP login is identical to the bucket's S3 credentials (`MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD`), which is why `DatabaseTemplateFactory`'s default username changed from a fixed `'berth'` to the sanitized service name (avoids every SFTPGo user colliding on the same default login, since — unlike per-container databases — the SFTPGo gateway is shared across all buckets on a server).

Still stubbed: live build-log/metric **streaming** into the UI (build output currently goes to the agent journal).

### mTLS / cert issuance (RESOLVED)

Panel **self-signed CA** generated on first boot (`agent-gateway/pki/ca.service.ts`, node-forge); CA key encrypted at rest with `BERTH_MASTER_KEY`. Agent generates a keypair + CSR (rcgen), enrolls over TLS at `wss://panel:4443/enroll?bootstrap=<token>` (single-use token), receives a CA-signed client cert, then holds the persistent channel at `/agent` over **mTLS** (`requestCert` + per-path `socket.authorized` gate). Raw `ws` on a Node `https` server — NOT socket.io. Agent TLS = rustls with the **ring** provider, CA pinned (never `danger_accept_invalid_certs`).

### Auth / security

Sessions are **httpOnly + Secure + SameSite=strict cookies** (not localStorage). CSRF = SameSite + required `X-Berth-Client` header (`CsrfGuard`). `helmet`, CORS locked to the UI origin, prod-secret refusal at boot, env secrets encrypted via `SecretCipher` (AES-256-GCM). Rust agent: `#![forbid(unsafe_code)]`, clippy-clean, crash-proof reconnect (backoff+jitter, log-and-continue), hardened systemd unit.

### Install

`install.sh` (repo root = the `berth.sh` PANEL installer) is fully automated: Docker + `docker-compose.prod.yml` (postgres, redis, server, ui), generates strong secrets, runs `prisma migrate deploy`, installs the native local agent, and auto-provisions the local server on first `/setup` (zero-touch). `apps/berth-agent/install.sh` remains the agent-only installer for remote "Add Server". User's only step: open the panel and create the admin.

## Open questions to resolve before/while building

- Monorepo tooling — using Turborepo + pnpm workspaces (settled in practice).
- License choice (Apache-2.0 vs AGPL-3.0).
- Live build-log/metric streaming into the UI is still a stub (build output goes to the agent journal for now).
