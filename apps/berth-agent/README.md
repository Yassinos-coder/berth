# berth-agent

Native per-server daemon (Rust). Runs as **root via systemd** — the only component with host-level access.

Responsibilities:
- Container lifecycle via Docker (`bollard`) with resource limits (`--cpus`, `--memory`, `--cpu-shares`)
- Reconciles actual Docker state to the desired `ServiceSpec[]` pushed by the panel
- Builds images (Dockerfile / Nixpacks) and streams build logs
- Streams container logs + metrics back to the panel
- Manages the reverse proxy (Caddy) for app domains + automatic HTTPS
- Dials **out** to the panel over WebSocket/mTLS (sidesteps NAT)

Not part of the pnpm/Turborepo workspace — built with Cargo. Requires the Rust toolchain (`cargo` not yet installed on this machine).
