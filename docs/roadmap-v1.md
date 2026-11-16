# Berth v1 roadmap

Berth is a self-hosted deployment platform for running your own services on infrastructure you control. The product should feel like a reliable internal platform, not a broad SaaS feature set.

## Objective

Ship a clear v1 that proves the core value loop:
- add a server
- deploy an app or service
- assign a domain and TLS
- monitor health and logs
- recover safely from failed deployments

## In scope

### Core deployment experience
- GitHub and Docker image deployments
- Service resource limits and health checks
- One-click volume and env-variable management
- Build logs and deploy history
- Safe rollback to the previous known-good version

### Server and security fundamentals
- agent enrollment, revocation and (planned) certificate renewal
- mTLS agent transport
- RBAC for owners, admins, deployers, viewers
- basic secret handling and encrypted-at-rest values
- protected API surface and request validation

### Platform operations
- reverse proxy and automatic HTTPS via Caddy
- domain + proxy host validation
- service metrics and basic alerts
- restore/recovery documentation and operational runbooks

## Out of scope

The following are intentionally deferred until after the core platform is stable:
- a hosted SaaS control plane
- a multi-tenant marketplace or app store
- rich serverless/function runtimes
- broad plugin ecosystems
- nonessential workflow automation beyond deploy/health/logging

## Release gates

We should only call v1 complete when the repo demonstrates all of the following:

### Product readiness
- a fresh install can onboard a server and deploy an app without manual intervention beyond initial setup
- the first successful deployment is visible in a clear audit trail
- logs and metrics are understandable to a user without reading agent internals

### Reliability
- deploy failures leave the previous version running and explain the cause
- agent reconnects, resyncs, and continues reconcile work after restarts or transient disconnects
- proxy updates and TLS changes do not leave the service in an invalid state

### Security
- certificate rotation and revocation paths are tested and documented
- secrets are encrypted at rest and never printed in logs or error output
- GitHub App and bootstrap token flows are scoped and short-lived

### Operations
- backups and restore steps are documented
- prod upgrades have tested rollback steps
- incident response runbooks exist for agent drift, failed rebuilds, and panel outage

## Recommended next milestones

### Milestone 1: ship the happy path
- server onboarding
- Git deploy from repo
- domain + HTTPS
- logs and metrics
- deployment history

### Milestone 2: harden safety
- rollback and restore flow
- certificate rotation and revocation
- secret rotation procedures
- deployment failure clarity

### Milestone 3: operational maturity
- alert routing and incident response docs
- upgrade checklists
- backup/restore drills
- documentation for support and troubleshooting

## Decision rule

When a request expands the scope beyond this core value loop, it should be treated as a future milestone or a product decision to explicitly defer. That keeps Berth from becoming a broad platform that does not reliably ship its core promise.
