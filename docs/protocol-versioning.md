# Protocol versioning

The panel and agent share one contract: `packages/protocol` (TypeScript) mirrored in `apps/berth-agent/src/protocol.rs`.

## Rules

- `PROTOCOL_VERSION` is a single integer, declared in both `packages/protocol/src/index.ts` and `apps/berth-agent/src/protocol.rs`. A Rust test fails if they differ.
- The agent sends its version when connecting: `/agent?protocol=<n>`.
- The panel refuses the connection (close code 1008, reason logged) when the agent is **newer** than the panel, or older than `MIN_SUPPORTED_AGENT_PROTOCOL`. Agents that send no version are treated as version 1.
- **Additive changes** (new optional field, new message the other side ignores, such as `RenewCertificate`) do not bump the version. The Rust side uses `#[serde(default)]` for new fields.
- **Breaking changes** (removed or renamed field, changed meaning, new required field) bump `PROTOCOL_VERSION`. Raise `MIN_SUPPORTED_AGENT_PROTOCOL` only once old agents can no longer be served.

## Upgrade order

Upgrade the **panel first**, then agents. The panel accepts every agent from `MIN_SUPPORTED_AGENT_PROTOCOL` up to its own version, so a panel never meets an agent newer than itself during a normal upgrade.

## Checklist for a breaking change

1. Bump `PROTOCOL_VERSION` in both places.
2. Make the panel handle the previous version until `MIN_SUPPORTED_AGENT_PROTOCOL` is raised.
3. Add a changelog line naming the minimum agent version.
4. Run `cargo test` and `bun run test`.
