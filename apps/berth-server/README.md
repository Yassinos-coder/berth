# @berth/server

Berth control plane (NestJS). The orchestration brain — **no Docker/host access**; delegates every privileged operation to `berth-agent`. Persists state in plain PostgreSQL via Prisma.

Responsibilities:
- Auth (GitHub OAuth, SSO later), RBAC, teams
- Source of truth in PostgreSQL (servers, apps, configs, encrypted secrets, deploy history)
- Receives GitHub webhooks → computes desired state → pushes `Reconcile(ServiceSpec[])` to the right agent
- Holds the agent-facing WebSocket/mTLS channel
- Exposes the API the UI consumes

Runs as a **Docker container** (with Postgres) for atomic upgrades.

_Not yet implemented — placeholder package._
