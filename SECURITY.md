# Security policy

Berth is a self-hosted deployment platform and therefore a critical infrastructure tool. Treat it like any other privileged runtime: the panel, agent, database, TLS, and secret handling must be hardened by default.

## Security principles

- The panel must never directly touch the host runtime.
- The agent is the only component allowed to manage Docker, Caddy, cgroups, and host-level operations.
- All agent-to-panel communication must use authenticated, encrypted transport over mTLS.
- Secret values are encrypted at rest and stripped from logs and API responses.
- Bootstrap tokens are short-lived and single-use.
- Reconciliation must preserve the last known-good state on failed deploys.

## Threat model

The primary risks are:
- compromised agent or compromised panel account
- stale or leaked client certificates
- leaked GitHub App credentials or webhook secrets
- accidental exposure of env vars or build logs
- unauthorized access from a misconfigured reverse proxy or public endpoint

## Baseline controls

### Authentication and session security
- Prefer httpOnly, Secure, SameSite cookies for session handling.
- Keep CSRF protections in place for browser-based requests.
- Require scoped RBAC for every authenticated action.
- Reject or revoke stale or unexpected agent identities.

### Transport and identity
- Use mutual TLS for agent enrollment and persistent agent connections.
- Use short-lived bootstrap tokens and burn them after use.
- Keep certificate issuance and revocation auditable.

### Secrets
- Store secrets encrypted at rest.
- Do not log secrets, raw env dumps, or full GitHub App payloads.
- Restrict access to values needed only for the agent or service to function.

### Deploy safety
- Never overwrite the last known-good service without a tested rollback path.
- Prefer zero-downtime cutovers with a safe fallback to the running container.
- Fail build, healthcheck, and proxy configuration errors loudly and clearly.

## Vulnerability reporting

If you discover a security issue, report it privately and responsibly. Do not open a public issue for a vulnerability that could be exploited.

Preferred reporting path:
- use a private security contact or the repository maintainer channel
- provide reproduction steps, impact, and affected versions if known
- allow a reasonable time for triage before public disclosure

## Security review checklist

Before claiming a release is ready, confirm:
- mTLS trust chain is valid and revocable
- certificates rotate without requiring invasive manual cleanup
- registry credentials and app secrets are encrypted at rest
- admin or deployer actions require proper authorization
- build logs and exception output do not expose sensitive data
- failed deploys retain the previous healthy revision

## Production checklist

For any self-hosted deployment of Berth:
- keep the panel and agent on patched versions
- rotate secrets regularly
- maintain backups of the PostgreSQL state and critical configuration
- verify agent connectivity after upgrades and certificate changes
- document who can revoke an agent or reset credentials

This project should be operated with the expectation that the control plane is security-critical infrastructure.
