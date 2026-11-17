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

## Deploy strategies

Each service chooses how new versions replace old ones (service **Settings → Deploys**):

| Strategy | What happens | Use it for |
| --- | --- | --- |
| **Zero downtime** (default) | The new version starts beside the old one, takes over once it is healthy, and the old one is removed. For a short moment both run. | Web apps and APIs |
| **Run once** | The old version is stopped first, then the new one starts. There is a brief gap, but two copies never run together. If the new version fails its health check, the old one is started again. | Bots, schedulers, and anything that trades, sends or charges |

A run-once service cannot have more than one replica or autoscaling, because that would defeat the guarantee.

## Load balancing and timeouts

Every domain is served through Caddy, which looks up all running replicas of a service about once a second and sends each request to the one with the fewest active connections.

- Scaling up adds a replica to the rotation within a second. Scaling down or replacing a container removes it just as fast.
- If a replica refuses a connection, the request is retried on another replica, or for up to 8 seconds until one answers. This hides the short gap while a container is swapped during a deploy.
- A replica that fails three connections within 10 seconds is skipped for a while. Error pages returned by your app (such as a 500) never count, so a buggy endpoint cannot take the whole service out of rotation.
- A backend that does not accept a connection within 5 seconds, or send response headers within 2 minutes, is cut off instead of holding the request forever.

## Build safety

A server handles one deploy at a time, so one bad build could hold up everything else on it. Builds are therefore limited:

- **Time limit.** A build that runs longer than 30 minutes is stopped, with a clear message in the build log. The previous version keeps running and other deploys continue.
- **Disk check.** Before cloning, Berth checks that the server has at least 3 GB free. If not, the deploy fails immediately and says how much space is free, instead of filling the disk halfway through.
- **Low priority.** Builds run at reduced CPU priority so they do not slow down the services already running.
- **Clean up.** The cloned source is deleted after every build, including failed and stopped ones.

You can change the limits on the server by setting `BERTH_BUILD_TIMEOUT_SECS` (minimum 60) and `BERTH_MIN_BUILD_FREE_GB` in `/etc/berth/agent.env` and restart the agent.

## Release command

A service can have a **release command**, set under the service's Settings tab, for example `npx prisma migrate deploy`.

On every deploy it runs once, after the build and before the new version starts, in a throwaway container made from the new image with the service's variables. Output appears in the build log.

- If it exits with an error, or takes more than 10 minutes, the deploy stops and the current version keeps running.
- It runs on every deploy, so make it safe to repeat. Migration tools already are.
- It runs once per deploy, not once per replica.
- It does not get the service's volumes or published ports.

## Panel backups

The panel's database holds everything Berth knows: services, settings, members and history. It is backed up every night at about 03:30 and the newest 14 backups are kept in `/var/backups/berth`.

A backup is one file containing the database, your `.env` (which holds `BERTH_MASTER_KEY`) and the panel's CA certificates. **Copy backups off this server.** The key and the data are on the same disk, so a lost server loses both. The file is readable by root only.

```bash
sudo berth-backup                          # back up now
sudo berth-backup list                     # see what exists
sudo berth-backup restore FILE             # restore the database
sudo berth-backup restore FILE --with-config   # also restore .env and certificates
```

Restore stops the panel briefly. Your deployed services keep running, because they are managed by the agent and not by the panel. Use `--with-config` when rebuilding on a new server so encrypted values stay readable.

Existing installs get the nightly timer the next time you run `sudo berth-update`. Without systemd, run `sudo berth-backup` from cron instead.

Backups of your own databases are separate: see the service's Backups tab.

## Traffic and error alerts

Every service that has a domain shows a **Traffic** card on its Metrics tab: requests, server errors (5xx), client errors (4xx) and p95 latency, for the range you pick. Numbers are summed once a minute and kept for 7 days.

If more than 5 percent of requests fail with a 5xx over 5 minutes (and there were at least 20 of them), Berth sends an alert to your notification channels, at most once an hour per service.

- **What is recorded.** Only the domain, status code and response time. Caddy removes visitor addresses, URLs and headers before writing its logs, including its error logs, so none of that is stored or sent to the panel.
- **Shared domains.** When a domain is split by path (for example `/` and `/api`), traffic is counted for the service that owns `/`.
- **Unknown hosts.** Requests for domains that are not routed to a service (scanners, for example) are ignored.
- **Latency.** The p95 over a range is an average of each minute's p95, weighted by request count.

## Container logs

Every container Berth starts keeps at most 30 MB of logs (3 files of 10 MB), so a chatty service cannot fill the disk. The limit applies when a container is next created, which for existing services means the next deploy.

## Crash detection and automatic rollback

The agent checks its containers every 10 seconds. It reports a service as crashed when its container exits with an error, sits in a restart loop, or restarts three or more times within five minutes, even if it briefly looks "up". It reports one event per crash, and another when the service recovers.

If a service built from GitHub crashes within 15 minutes of a new version going live, and an earlier working version exists, Berth restores that version automatically and notifies you. It never rolls back a rollback, so it cannot loop. You can turn this off per service.

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
