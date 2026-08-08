#!/usr/bin/env bash
# Berth self-update — pull the latest production build and roll it out with no
# downtime for deployed services. Run as root (via `berth-update` or the panel's
# "Update now" button, which launches it in its own systemd scope).
set -euo pipefail

REPO_DIR="${BERTH_REPO_DIR:-/opt/berth}"
COMPOSE_FILE="docker-compose.prod.yml"
BIN_PATH="/usr/local/bin/berth-agent"

log() { printf '\033[36m[berth/update]\033[0m %s\n' "$*"; }

cd "$REPO_DIR"

log "fetching latest production"
git fetch --depth 1 origin production
# Untracked files (.env, panel-certs/, certs/) are preserved by reset --hard.
git reset --hard origin/production

log "rebuilding & restarting the panel (deployed services keep running)"
# Only the changed server/ui images are rebuilt and their containers recreated;
# postgres, redis and every agent-managed container are left running.
BERTH_COMMIT="$(git rev-parse --short HEAD)" \
  docker compose -f "$COMPOSE_FILE" --project-directory "$REPO_DIR" up -d --build

if command -v cargo >/dev/null 2>&1 || [[ -x /root/.cargo/bin/cargo ]]; then
  log "rebuilding the agent"
  export PATH="/root/.cargo/bin:${PATH}"
  cargo build --release --manifest-path "$REPO_DIR/apps/berth-agent/Cargo.toml"
  install -m 0755 "$REPO_DIR/apps/berth-agent/target/release/berth-agent" "$BIN_PATH"
  # Refresh the systemd unit so unit changes (e.g. build-friendly sandboxing) land.
  if [[ -f "$REPO_DIR/apps/berth-agent/berth-agent.service" ]]; then
    install -m 0644 "$REPO_DIR/apps/berth-agent/berth-agent.service" \
      /etc/systemd/system/berth-agent.service
    systemctl daemon-reload
  fi
  log "restarting the agent (managed containers are unaffected)"
  systemctl restart berth-agent
fi

log "update complete"
