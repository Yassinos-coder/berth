# Developer guide

## Monorepo layout

```text
berth/
├── apps/
│   ├── berth-agent/       # Native Rust agent
│   ├── berth-server/      # NestJS control plane
│   ├── berth-ui/          # React dashboard
│   └── berth-docs/        # Documentation website (GitHub Pages)
├── docs/                  # product and operations documentation
├── packages/
│   ├── protocol/          # shared panel/agent contract
│   └── cli/               # CLI and MCP surfaces
├── README.md
├── SECURITY.md
├── CHANGELOG.md
├── package.json
├── bun.lock
└── .github/workflows/
```

## Local development

### Prerequisites

- [Bun](https://bun.sh) 1.2 or newer (package manager and script runner; there is no pnpm or npm step)
- Node.js 20 or newer (runs the panel)
- Rust stable (agent only)
- Docker (Postgres and Redis for local runs)

### Clean-machine bootstrap

```bash
bun install
docker compose up -d postgres redis
cp .env.example .env
bun --filter @berth/protocol build
bun --filter @berth/server prisma:generate
bun --filter @berth/server migrate
bun run dev:server
```

The UI runs separately with `bun run dev:ui`. Redis is optional in development.

### Install dependencies

```bash
bun install
```

### Start the docs site

```bash
bun run docs:dev
```

### Build the docs site

```bash
bun run docs:build
```

### Build the main product UI and backend

```bash
bun run build
```

### Run the server app

```bash
bun --filter @berth/server dev
```

### Run the UI app

```bash
bun --filter @berth/ui dev
```

### Run the landing page

```bash
bun --filter @berth/landing dev
```

### Run the Rust agent

```bash
cargo run --manifest-path apps/berth-agent/Cargo.toml
```

## Production-quality expectations

The project should be treated as a critical platform, not a simple prototype. Contributions should respect:
- security-first deployment behavior
- reproducible build steps
- clear documentation
- rollback-safe change patterns
- explicit operational tradeoffs

## Contribution rules

- prefer small, well-scoped PRs
- keep architecture aligned with the agent + panel split
- document any product or operational change in `docs/` or the changelog
- add security considerations for new credential or API flows
- validate with focused tests and build checks

## Release workflow

1. update the changelog
2. validate targeted tests and build commands
3. confirm docs and runbooks still match the implementation
4. verify that rollback and recovery steps are still valid
5. ship with a clear known-good path for operators
