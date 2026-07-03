# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-03

### Added
- Initial project scaffold as a Turborepo + pnpm monorepo.
- Architecture and design documentation (`README.md`, `CLAUDE.md`, `docs/architecture.md`) covering the self-hosted topology, native Rust agent + containerized panel split, declarative reconciliation protocol, and the `ServiceSpec` core abstraction.
- `@berth/protocol` shared package defining the panel↔agent message contract (`ServiceSpec`, `Reconcile`, and event types).
- Placeholder workspaces for `berth-agent` (Rust/Cargo), `berth-server` (NestJS), and `berth-ui` (React + Vite, shadcn/ui, Tailwind CSS v4).
