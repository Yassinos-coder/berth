# Scaling and replication guide

## Goals

Berth must support both small single-host deployments and larger multi-server fleets without changing the control-plane model. The system should be able to scale vertically by increasing resources on a single host and horizontally by adding more agents and distributing workloads across them.

## Vertical scaling

CPU and memory limits can be changed from a service's Settings tab. For healthy existing containers, the agent applies new limits with `docker update`; image builds and container replacement are not needed. The change is reconciled across all replicas. Increases are checked against the server's aggregate CPU and memory reservations.

Use this when:
- a service is memory-bound or CPU-bound
- a workload is stable and needs more resources on the same host
- the service must keep the same identity and network configuration

## Horizontal scaling

The agent now reconciles a service's desired replica count into containers on its assigned server. Set the count from 1 to 32; each replica receives the service's network aliases, per-replica CPU and memory limits, and health-gated replacement on redeploy. Caddy reaches the replica set through the service's Docker network alias.

Replica policies are validated, normalized, persisted in Postgres, and evaluated every minute using recent persisted CPU and memory samples. The evaluator requires at least two samples, ignores stale metrics, honors the policy cooldown, and persists each scale decision before requesting reconciliation. Automated scale-ups, manual replica increases, and service creation share a per-server lock and are blocked when existing service CPU or memory limits plus the requested replicas exceed the server's reported capacity. Scale-downs remain available even when current reservations are over capacity.

The guard excludes stopped services from reservations, but starting, restarting, or redeploying a stopped service first checks that its reservation fits. Replicas stay on one server, and a service with persistent volumes or directly published host ports cannot use more than one replica. Shared writable volumes and conflicting host-port bindings are rejected instead of creating unsafe duplicate containers. The capacity check accounts for service limits but does not reserve resources for the host OS or Berth's own containers; leave that headroom when setting policies. Horizontal scaling across servers is not implemented yet.

Use this when:
- a stateless service needs more throughput on its assigned server
- several instances should be reachable behind a proxy host or ingress
- a service needs redundancy against an individual container failure, not a server failure

Future fleet-level controls:
- service placement across registered servers
- health checks and readiness gating across hosts
- connection-aware routing and health-based backends

## Replication model

The single-server replication model is:

1. A service declares its desired replica count.
2. The control plane stores that desired state in Postgres.
3. The agent reconciles actual containers to match that desired state.
4. New additional replicas pass health checks before they are kept.
5. A failed replica is reported by reconciliation; the last available primary is retained when adding or replacing an additional replica fails.

Operational rules:
- do not scale a service with shared writable volumes or directly published host ports
- keep replica changes observable through reconciliation results
- use a single source of truth for desired state
- preserve the last known-good deployment when a rollout fails

## Multi-server fleet strategy

A fleet is a collection of server agents behind one control plane.

The system should support:
- one panel managing many agents
- target placement by server group or environment
- resource tracking and load visibility per server
- deployment failure isolated to a single server instead of the whole fleet

## Scaling decisions

| Need | Preferred pattern |
| --- | --- |
| More CPU or RAM for one service | Vertical scaling |
| More traffic or redundancy | Horizontal scaling |
| Same service on multiple nodes | Replicated service |
| Many unrelated workloads | Multi-server fleet |

## Production rules

- Always test replica changes in a staging environment first.
- Keep health checks explicit and fast.
- Do not ignore resource alerts during scale-up.
- Ensure rollback still works when replica changes fail.
- Keep proxying and traffic routing aligned with backend replicas.

## Recommended roadmap

1. Ship reliable single-server scaling fundamentals.
2. Add explicit replica support and health-gated rollout logic.
3. Add multi-server placement and fleet awareness.
4. Add autoscaling triggers based on CPU, memory, and request rate.
5. Add more sophisticated orchestration only after the core is validated.
