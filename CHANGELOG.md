# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.10.3] - 2026-08-09

### Added
- **Bucket SFTP access.** The agent now runs a second managed container, `berth-sftpgo`, and provisions one SFTP user per bucket (port 2022, same login as the bucket's S3 credentials), backed by that bucket's own MinIO instance. The agent also auto-creates the bucket inside MinIO on reconcile, since a fresh `minio/minio` server ships with none. Shown as a new SFTP row in the service Connect tab. Legacy FTP was deliberately left out — passive-mode FTP needs a large published port range that doesn't fit the per-container model here.
- Custom username/password override when creating a managed Database, Template, or Bucket — leave blank to keep auto-generating credentials as before.
- A collapsible **Advanced settings** section in New Service exposing a Disk allocation field (planning only — Docker can't enforce per-container disk quotas on most filesystems) alongside CPU/Memory, plus a live free/total disk hint for the selected server.
- Real disk usage reporting from the agent (`df`-based, every 60s), replacing a stub that always reported 0. Also fixes a latent bug where the disk figure captured at enrollment was actually free space mislabeled as total capacity.
- A "Recent activity" clear button (owner/admin only, confirmation required).
- An "Auto-scaled" badge on service cards when smart resources has raised that service's memory limit, with a tooltip showing when.

### Changed
- The metrics "Peak … over last hour" stat is now a real rolling 24-hour peak tracked server-side, replacing a label that was already inaccurate (the underlying buffer only held about 8 minutes of samples).
- Managed database/template services default to a username derived from the service name instead of the fixed `berth`, so SFTPGo users (which must be unique per server) don't collide by default across buckets.

## [0.10.2] - 2026-08-09

### Fixed
- The **Bucket** and **Template** options in New Service had no way to pick what to deploy — selecting either always failed on submit ("Search for or enter an image") because no config UI was wired up for them. Bucket now provisions a managed MinIO container immediately on selection; Template now shows a picker (Postgres, Redis, MySQL, MinIO, Mongo, RabbitMQ) backed by the existing templates catalog. The Templates gallery page's cards now deep-link into the wizard with the chosen template preselected. Empty Service had the same underlying gap (no image field) and is fixed alongside it.

## [0.10.1] - 2026-08-08

### Fixed
- Git services now pass saved `VITE_*` variables into Docker builds, so Vite frontends use their configured production API and authentication endpoints instead of Dockerfile placeholder defaults. Only the explicitly public `VITE_*` namespace is forwarded; backend secrets remain runtime-only.

## [0.10.0] - 2026-08-08

### Added
- Live container log streaming and four-second CPU, memory, and network I/O telemetry from the agent.
- A Domains tab on service details for managing public proxy hosts and private `*.berth.local` Docker network aliases.
- New services receive a generated internal domain automatically; additional aliases can be generated or removed from the UI.

### Changed
- Service logs and metrics refresh more frequently for a near-real-time view.

## [0.9.2] - 2026-08-08

### Added
- Service cards now show their proxy-host domain(s), so you can see which domains route to a service at a glance.

### Changed
- Deployment history labels the trigger clearly — a GitHub push shows a "GitHub push" badge (with the commit id/message) instead of a bare "manual".

## [0.9.1] - 2026-08-08

### Fixed
- The managed Caddy proxy container failed to start (`exec: "run": executable file not found`) — the `docker run` didn't set the image entrypoint, so `run` was execed directly. The agent now starts it with `--entrypoint caddy`.

## [0.9.0] - 2026-08-08

### Added
- **Reverse proxy & host management (Nginx-Proxy-Manager style)** powered by a managed **Caddy** container the agent runs on the `berth` network. A new **Proxy Hosts** screen maps a domain → a running service with **automatic HTTPS** (Let's Encrypt, auto-renew), **HTTP/2 + HTTP/3**, and force-HTTPS. The add dialog auto-detects your services and pre-fills the container port; certificates persist in a `berth-caddy-data` volume.
- `ProxyHost` model + `GET/POST/PATCH/DELETE /api/proxy-hosts`. Proxy routes flow to the agent over the existing reconcile channel (`Reconcile.proxies`); the agent regenerates the full Caddy config each reconcile and applies it via `caddy reload`. Caddy proxies to services by their stable container name, so renaming a service never breaks a route. The Service API now exposes `containerPort`.
- The agent installer opens ports 80/443 when `ufw` is active, and an optional `BERTH_ACME_EMAIL` sets the Let's Encrypt contact.

## [0.8.5] - 2026-08-08

### Added
- Rename a service inline from its detail page: click the name, edit, and it saves on blur (or Enter; Escape cancels). `PATCH /api/services/:id` now accepts `name` for any service kind (build-config fields stay git-only).

## [0.8.4] - 2026-08-08

### Fixed
- Agent Docker/Nixpacks builds failed under the hardened systemd unit (`mkdir /root/.docker: read-only file system`). The agent unit now provisions a writable state directory (`StateDirectory=berth`) with `HOME` and `DOCKER_CONFIG` pointing into it, and raises the memory ceiling to 1G for the build client. `self-update.sh` now also reinstalls the systemd unit so existing installs pick up unit changes on update.

## [0.8.3] - 2026-08-07

### Added
- The Variables tab now actually persists environment variables to a service and applies them to the container on the next deploy, backed by `GET`/`PUT /api/services/:id/env`. Includes a **bulk ".env paste"** import that parses `KEY=value` lines, overwrites/adds by key, and auto-flags secret-looking keys (stored encrypted at rest).

## [0.8.2] - 2026-08-07

### Added
- Build settings now include a **builder selector** (Auto / Dockerfile / Nixpacks) and a **Dockerfile path**, so a repository's own Dockerfile can be used instead of Nixpacks — including a monorepo Dockerfile built from the repo root. This lets one repo back multiple services (e.g. a frontend and a backend) by pointing each at a different Dockerfile.

## [0.8.1] - 2026-08-07

### Fixed
- The footer "Update now" button no longer fails with "No local server found" after the local server was removed and re-added. The panel now falls back to the sole server on a single-box install, and any enrolling agent whose hostname matches the panel host is automatically flagged as the local server.

## [0.8.0] - 2026-08-07

### Added
- Railway-style build settings for git services (service → Settings → Build & deploy): **root directory**, **build command**, and **start command**. The root directory scopes the build to one app in a monorepo, and the build/start commands are passed to Nixpacks (`--build-cmd` / `--start-cmd`) so a Turborepo app deploys correctly. A `PATCH /api/services/:id` endpoint persists them; redeploy to apply.

## [0.7.2] - 2026-08-07

### Added
- "Regenerate token" on a server's detail page re-issues a fresh bootstrap so an agent can re-enroll — for example after the panel is reinstalled with a new certificate authority. For the local server it prints the exact update-token-and-restart commands.

### Changed
- Bootstrap tokens now last 60 minutes instead of 15, giving more time to run the install command.

### Fixed
- A panel reinstall no longer strands the local agent: the installer removes an agent certificate that no longer matches the panel's CA and restarts the agent on re-run, so it re-enrolls automatically.

## [0.7.1] - 2026-08-07

### Added
- Settings → General now shows the running Berth version and commit, and whether a newer `production` build is available.

## [0.7.0] - 2026-08-07

### Added
- One-click GitHub App setup via the GitHub App Manifest flow: **Create GitHub App** in Settings registers a per-instance App on GitHub and stores the returned App ID, private key, and webhook secret encrypted in the database — no manual App creation, permissions, or `.env` editing. The Connect card now walks through Create → Install → Connected.

### Changed
- GitHub App credentials are resolved from the database first (manifest-created App) and fall back to environment variables, so `GITHUB_APP_*` env vars are now optional.

## [0.6.0] - 2026-08-07

### Added
- GitHub App installation flow with signed callbacks, installation-scoped repository and branch pickers, and support for public and private repositories.
- HMAC-verified GitHub push webhooks that queue deployments and reconcile services tracking the pushed branch.
- Agent-side Git builds using a Dockerfile when present and Nixpacks otherwise; installation tokens are short-lived and redacted from errors.

### Changed
- The agent installer now installs Nixpacks, and deployment records transition to live or failed from agent status events.

### Fixed
- Copy buttons now fall back to `execCommand` on plain HTTP where the Clipboard API is unavailable.

### Security
- Hardened the GitHub App install callback: the OAuth `state` now carries a single-use, organization-bound nonce verified with a pinned algorithm, invalid state is rejected cleanly, and an installation already linked to another organization can no longer be rebound (prevents cross-organization repository access).

## [0.5.0] - 2026-08-07

### Added
- Self-update: a footer shows the running version and, when a newer `production` build exists, an "Update available" pill with a copy-able `sudo berth-update` command and an owner/admin "Update now" button.
- One-click update runs on the native agent (over the existing mTLS channel, in its own systemd scope) so it survives the agent's own restart; deployed apps, databases, Postgres and Redis keep running — only the panel's own containers recreate briefly.
- SSH login notice (`/etc/update-motd.d`) that flags when a Berth update is available.
- `GET /api/system/version` (version, commit, latest `production` commit, update-available) and an owner-only `POST /api/system/update`.

### Changed
- Default branch is now **`production`**; the installer, agent, and self-update track and update from `production` only. The commit SHA is baked into the server image at build time.

## [0.4.1] - 2026-08-07

### Fixed
- Panel installer crashed at `cd` because log output was written to stdout and captured alongside function return values. Logs now go to stderr.

### Changed
- Installer is now re-runnable and shows clean, checkmarked steps (details captured to `/var/log/berth-install.log`) instead of raw command output; prompts on the real terminal only when a decision is needed (e.g. reusing an existing config).

## [0.4.0] - 2026-07-13

### Added
- Docker Hub image search in the New Service wizard — search by name, see official/star badges, and pick a tag from a live list (Docker-Desktop style).
- Managed databases (Railway-style): choose Redis, Postgres, MySQL, MariaDB, or MongoDB and Berth generates the username, password, data volume, and port automatically. A new **Connect** tab shows private and public connection URLs, credentials (reveal + copy), and all variables.
- Service-to-service private networking: managed containers join a shared `berth` Docker network and are addressable by service name; public exposure is opt-in per service.

### Changed
- Environment variables are now persisted per service and encrypted at rest; the agent supports container `command` overrides (used for Redis auth) and reports its dial-in address so public URLs resolve.

## [0.3.0] - 2026-07-12

### Added
- Docker Hub image search and live tag selection in the service creation wizard, including official-image metadata and database detection.
- Managed Redis, PostgreSQL, MySQL, MariaDB, and MongoDB templates with generated encrypted credentials, persistent volumes, engine-specific configuration, and optional public networking.
- Railway-style database connection details with private and public URLs, reveal/copy controls, and generated connection variables.
- A shared Docker network with service-name aliases, custom container commands, and persisted environment, port, and volume configuration across the panel-to-agent protocol.
- Public landing page (`apps/berth-landing-page`, Vite + Tailwind v4) with a one-command install box and copy-to-clipboard button for `curl -fsSL https://berth.sh | sudo bash`.
- Berth brand identity — a bespoke mooring-cleat logo shipped as source SVGs plus a generated favicon, Apple touch icon, PWA icons, `favicon.ico`, and an OpenGraph social image, with a reproducible icon generator.
- Amazon Linux / RHEL support in both the panel and agent installers: package-manager detection (`apt`/`dnf`/`yum`) and a Docker Compose plugin fallback.

### Changed
- The in-app brand mark and browser favicons now use the new mooring-cleat logo instead of the placeholder anchor.
- Installers branch package installation and Docker setup by OS family instead of assuming Debian/Ubuntu.

### Removed
- Placeholder `anchor.svg` favicon.

## [0.2.0] - 2026-07-04

### Added
- Agent-to-panel mTLS infrastructure across the Rust agent and NestJS gateway, including certificate enrollment, CA issuance, persistent WebSocket reconciliation, and reconnect handling.
- Production-facing deployment assets for the panel stack, including container Dockerfiles, `docker-compose.prod.yml`, a root `install.sh`, and a local dev bootstrap script for the server.
- Initial Prisma migration files and bootstrap provisioning for the local managed server during first-time setup.

### Changed
- Authentication now uses secure httpOnly cookie sessions with a `GET /auth/me` flow, logout support, setup-aware routing, and frontend session hydration instead of persisted bearer tokens.
- The agent now validates desired `ServiceSpec` payloads before applying Docker changes and runs with a more defensive release profile and hardened systemd service defaults.
- Server startup now enables stricter production configuration, CORS configuration, cookie parsing, and centralized exception handling.

### Security
- Added CSRF enforcement for the web client, encrypted secret storage support, `helmet` hardening, and cookie-based auth guard support on the API.

## [0.1.0] - 2026-07-03

### Added
- Initial project scaffold as a Turborepo + pnpm monorepo.
- Architecture and design documentation (`README.md`, `CLAUDE.md`, `docs/architecture.md`) covering the self-hosted topology, native Rust agent + containerized panel split, declarative reconciliation protocol, and the `ServiceSpec` core abstraction.
- `@berth/protocol` shared package defining the panel↔agent message contract (`ServiceSpec`, `Reconcile`, and event types).
- Placeholder workspaces for `berth-agent` (Rust/Cargo), `berth-server` (NestJS), and `berth-ui` (React + Vite, shadcn/ui, Tailwind CSS v4).
