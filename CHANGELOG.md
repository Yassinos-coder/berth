# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
