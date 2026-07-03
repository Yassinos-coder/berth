# berth-agent

Native per-server daemon (Rust). Runs as **root via systemd** - the only component with host-level access.

Responsibilities:
- Container lifecycle via Docker with resource limits (`--cpus`, `--memory`, `--cpu-shares`)
- Reconciles actual Docker state to the desired `ServiceSpec[]` pushed by the panel
- Builds images (Dockerfile / Nixpacks) and streams build logs
- Streams container logs + metrics back to the panel
- Manages the reverse proxy (Caddy) for app domains + automatic HTTPS
- Dials **out** to the panel over WebSocket/mTLS (sidesteps NAT)

Current implementation status:
- `berth-agent run` connects to `BERTH_PANEL_URL`, sends an `Enrolled` message, and handles `Reconcile` / `RemoveService`.
- `berth-agent reconcile-file <path>` applies a local `ServiceSpec[]` or `Reconcile` JSON payload without needing panel transport.
- Image-based services are supported first; git-source builds, log streaming, metrics, reverse proxying, and mTLS are still TODOs.

Not part of the pnpm/Turborepo workspace - built with Cargo. Requires the Rust toolchain.

Installer assets:
- `install.sh` installs Docker, the Rust toolchain, build dependencies, the agent binary, `/etc/berth/agent.env`, and the `systemd` unit.
- `berth-agent.service` is the unit template the installer copies into `/etc/systemd/system/`.

Typical usage on a server:
```bash
curl -fsSL https://berth.sh/install | BERTH_PANEL_URL=wss://panel.example.com:4443 BERTH_BOOTSTRAP=... BERTH_REPO_URL=https://github.com/your-org/berth.git sudo bash
```

If you run the installer from a checked-out repo instead of a hosted script:
```bash
sudo BERTH_PANEL_URL=wss://panel.example.com:4443 BERTH_BOOTSTRAP=... ./apps/berth-agent/install.sh
```
