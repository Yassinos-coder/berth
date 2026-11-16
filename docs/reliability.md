# Reliability and observability

## Desired state and reconcile guarantees

Postgres holds the desired state. The panel sends `Reconcile(ServiceSpec[])` and the agent converges to it.

Guarantees the implementation provides, and the tests that back them:

- **Idempotent.** Each managed container carries `berth.spec_hash`. An unchanged spec causes no container change (`identical_specs_hash_identically_across_deserializations`).
- **Resource and replica changes are live.** CPU/memory limits are applied to running containers; replica count changes add or remove replicas. Neither forces a rebuild (`resource_limit_changes_do_not_force_a_rebuild`, `replica_count_changes_do_not_force_a_redeployment`).
- **Secret rotation is not drift.** Rotating a short-lived installation token does not change the hash (`rotating_the_installation_token_does_not_change_the_hash`).
- **Self-healing.** A reconcile is sent on every agent (re)connect, so a rebooted or reconnected host converges without operator action.
- **Safe cutover.** A changed service starts a new container, waits for health, and only then removes the old one. A failed health check leaves the old container serving.
- **Scoped.** Unlabeled containers are never touched.

Drift detection is the spec-hash comparison on each reconcile. There is no continuous background re-check between reconciles yet.

## Lifecycle state model

| Entity | States |
| --- | --- |
| Agent | `enrolling` → `online` ⇄ `offline` / `degraded` |
| Service | `building`, `starting`, `running`, `unhealthy`, `stopped`, `crashed` |
| Deployment | `queued` → `building` → `deploying` → `live` / `failed` / `canceled` |

### Rollback

Rolling back (`POST /deployments/:id/rollback`) restores the **exact commit** of an earlier deployment:

- only a deployment that reached `live` and recorded a commit can be rolled back to; anything else is refused instead of silently redeploying the branch head
- the service is pinned to that commit and rebuilt; the agent checks out that commit and fails the deploy if it cannot (for example after a force-push removed it), leaving the running version untouched
- the next push, or a manual redeploy, clears the pin and returns to the branch head

Image services have no commit to restore. Change the tag and redeploy instead.

## Database correctness

- CI applies every migration to an empty Postgres and fails if `prisma/schema.prisma` differs from the migrations (schema drift check).
- Migration folders are zero-padded (`00_`, `01_`, …) so a fresh database applies them in order. `bun run migrate` also renames recorded history on databases created before padding, so upgrades are safe.
- New migrations use the next number, for example `31_…`.

## Observability

- **Correlation IDs.** Every HTTP response carries `x-request-id`. A well-formed incoming id is reused, otherwise one is generated. Request logs and unhandled-error logs include it, and 500 responses return it in the body so a user report maps to a log line.
- **Build logs.** Streamed line by line from the agent, with `==> ` stage markers (Clone, Build, Start, Health).
- **Failure reasons.** A failed deploy stores the agent's redacted reason, shown in the UI.
- **Metrics.** Per-minute CPU/memory/disk samples kept 7 days, with sustained-pressure alerts and per-service mute.
- **Alert routing.** Notification channels: Slack, Discord, generic webhook and email (SMTP).
- **Request id to the agent.** A reconcile triggered by an HTTP request carries that request's id. The panel logs it and the agent journal prints it, so one id links the user action, the panel and the host.

### Not built yet

- Per-agent health dashboard beyond status and metrics.
- Escalation policy (repeat/escalate when a host stays down).
- Storing the request id on deployment records.
