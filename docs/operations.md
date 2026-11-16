# Berth operations guide

This guide defines the minimum operational practices for a self-hosted Berth deployment. It exists to make the platform understandable, recoverable, and safe to operate in production.

## Core operating principles

- The panel is a control plane; the agent is the privileged runtime.
- The agent must be the only component that touches Docker, cgroups, Caddy, and host-level service state.
- Secrets are never printed in logs or UI error messages.
- A failed deploy must preserve the last known-good service state.
- Every production change should have an explicit rollback path.

## Service-level incident response

### 1. Service deploy fails

Symptoms:
- build exits non-zero
- app never becomes healthy
- deploy is marked failed while the old app remains running

Checklist:
1. Read the build log and find the stage that failed.
2. Confirm whether the previous container remained running.
3. Verify whether the failed deploy changed any env variables or filesystem state.
4. Check for Docker image pull, permission, or healthcheck failures.
5. If the app is broken, revert to the last known-good image or config.

Recovery guidance:
- keep the previous container available until the new one is healthy
- do not silently keep a broken service marked as live
- record the failure reason in deployment metadata and logs

### 2. Service is unhealthy after deploy

Checklist:
1. Inspect the service health check configuration.
2. Review recent build logs and container events.
3. Confirm the port binding and domain configuration.
4. Check whether a new image expects different runtime env vars.
5. Compare with the last known-good deployment.

Fallback:
- rollback to the previous running image
- confirm the service is healthy before redeploying

### 3. Proxy host fails or TLS is broken

Checklist:
1. Validate the DNS record and public IP mapping.
2. Confirm that Caddy has a valid certificate challenge path.
3. Verify the service is listening on the expected internal port.
4. Check whether the proxy path and host mapping match the service definition.
5. Inspect recent Caddy reload activity and service health.

Recovery guidance:
- do not leave a domain mapped to a broken upstream
- verify the service is reachable internally before re-enabling public routing

## Agent incident response

### 1. Agent disconnects or reconnects repeatedly

Checklist:
1. Confirm the panel is reachable and the agent's WebSocket URL is valid.
2. Verify the certificate remains valid and not revoked.
3. Check whether the agent is restarting due to configuration drift.
4. Inspect Docker health and agent logs.
5. Confirm the panel has not rejected the client certificate.

Recovery guidance:
- prefer re-enrollment with a fresh bootstrap token over manual certificate tampering
- do not delete the CA or agent identity without a full recovery plan

### 2. Agent certificate expires or is stale

Checklist:
1. Revalidate the panel CA and agent cert chain.
2. Check whether a reinstall or panel migration caused certificate mismatch.
3. Confirm the agent still has the valid bootstrap flow path or a revocation-safe replacement.

Recovery plan:
- rotate or re-enroll the agent with a fresh certificate
- invalidate the old certificate if the trust boundary is uncertain

## Secret rotation

Secrets must be rotated without re-creating the whole infrastructure.

Rotation checklist:
- rotate the panel master key or backup decryption key in a controlled maintenance window
- rotate the GitHub App private key if it is suspected to be exposed
- rotate database or S3 credentials associated with managed services
- verify the service still starts after the new values are applied
- validate that no stale values remain in logs or env dumps

## Backup and restore

Before a major upgrade or migration:
1. back up the PostgreSQL data used by the panel
2. back up any GitHub App configuration and metadata
3. export critical service env-var values or backup targets
4. note current server registration and certificate fingerprints

Rollback path:
- restore the panel database
- verify server trust and agent enrollment state
- confirm the agent reconnects and reconciles
- validate deploy history and service status after restore

## Upgrade checklist

Before rolling out a new panel or agent version:
- review the changelog and migration notes
- verify the agent/server compatibility matrix
- confirm the release has been tested in a disposable environment
- record current cert fingerprints and server inventory
- ensure the rollback path is documented before the upgrade starts

## Escalation and ownership

A production incident should be routed by impact:
- critical: service outage or cert trust issue
- high: broken deploy pipeline or lost secret access
- medium: degraded performance or partial proxy misrouting
- low: feature or UI issue without service impact

The owning operator should record:
- incident summary
- root cause
- actions taken
- recovery result
- follow-up to prevent recurrence

## Support posture

Berth is self-hosted. That means operators must be responsible for host-level hardening, backup strategy, and incident handling. The project should make that easier through clear documentation, but it cannot eliminate the need for basic infrastructure hygiene.
