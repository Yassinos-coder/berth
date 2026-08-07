# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
