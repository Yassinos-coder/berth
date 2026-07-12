#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="berth-agent"
INSTALL_ROOT="/opt/berth"
SOURCE_DIR_DEFAULT="$INSTALL_ROOT/src"
ENV_DIR="/etc/berth"
ENV_FILE="$ENV_DIR/agent.env"
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
BIN_PATH="/usr/local/bin/berth-agent"
PKG=""

log() {
  printf '[berth-agent/install] %s\n' "$*"
}

fail() {
  printf '[berth-agent/install] ERROR: %s\n' "$*" >&2
  exit 1
}

require_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    fail "run this script as root or with sudo"
  fi
}

detect_repo_root() {
  local script_dir
  script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  local candidate
  candidate="$(cd "$script_dir/../.." && pwd)"

  if [[ -f "$candidate/apps/berth-agent/Cargo.toml" ]]; then
    printf '%s\n' "$candidate"
    return 0
  fi

  return 1
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then PKG="apt"
  elif command -v dnf >/dev/null 2>&1; then PKG="dnf"
  elif command -v yum >/dev/null 2>&1; then PKG="yum"
  else fail "no supported package manager found (need apt, dnf, or yum)"; fi
  log "package manager: ${PKG}"
}

install_base_packages() {
  log "installing base build dependencies"
  case "$PKG" in
    apt)
      apt-get update -y
      apt-get install -y --no-install-recommends \
        ca-certificates curl git build-essential pkg-config libssl-dev \
        software-properties-common apt-transport-https gnupg
      ;;
    dnf | yum)
      "$PKG" install -y ca-certificates curl git gcc gcc-c++ make
      ;;
  esac
}

install_docker_if_needed() {
  if command -v docker >/dev/null 2>&1; then
    log "docker already installed"
    return 0
  fi

  . /etc/os-release
  log "installing Docker Engine"
  case "$PKG" in
    apt)
      local keyring="/etc/apt/keyrings/docker.asc"
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL https://download.docker.com/linux/"${ID}"/gpg -o "$keyring"
      chmod a+r "$keyring"
      echo "deb [arch=$(dpkg --print-architecture) signed-by=${keyring}] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
        >/etc/apt/sources.list.d/docker.list
      apt-get update -y
      apt-get install -y docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
      ;;
    dnf | yum)
      "$PKG" install -y docker
      ;;
  esac
  systemctl enable --now docker
}

install_rust_if_needed() {
  if command -v cargo >/dev/null 2>&1 && command -v rustc >/dev/null 2>&1; then
    log "Rust toolchain already installed"
    return 0
  fi

  log "installing Rust via rustup"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
}

resolve_source_dir() {
  if [[ -n "${BERTH_AGENT_SOURCE_DIR:-}" ]]; then
    [[ -f "${BERTH_AGENT_SOURCE_DIR}/apps/berth-agent/Cargo.toml" ]] || \
      fail "BERTH_AGENT_SOURCE_DIR does not look like a berth repo checkout"
    printf '%s\n' "$BERTH_AGENT_SOURCE_DIR"
    return 0
  fi

  if repo_root="$(detect_repo_root)"; then
    printf '%s\n' "$repo_root"
    return 0
  fi

  if [[ -n "${BERTH_REPO_URL:-}" ]]; then
    log "cloning berth repo from BERTH_REPO_URL into ${SOURCE_DIR_DEFAULT}"
    rm -rf "$SOURCE_DIR_DEFAULT"
    install -d "$INSTALL_ROOT"
    git clone --depth 1 "$BERTH_REPO_URL" "$SOURCE_DIR_DEFAULT"
    printf '%s\n' "$SOURCE_DIR_DEFAULT"
    return 0
  fi

  fail "set BERTH_AGENT_SOURCE_DIR or BERTH_REPO_URL when running this script outside a berth repo checkout"
}

build_agent() {
  local repo_root="$1"
  export PATH="/root/.cargo/bin:${PATH}"

  log "building berth-agent from source"
  cargo build --release --manifest-path "$repo_root/apps/berth-agent/Cargo.toml"

  install -m 0755 "$repo_root/apps/berth-agent/target/release/berth-agent" "$BIN_PATH"
}

write_env_file() {
  [[ -n "${BERTH_PANEL_URL:-}" ]] || fail "BERTH_PANEL_URL is required"

  install -d "$ENV_DIR"

  cat >"$ENV_FILE" <<EOF
BERTH_PANEL_URL=${BERTH_PANEL_URL}
BERTH_BOOTSTRAP=${BERTH_BOOTSTRAP:-}
BERTH_AGENT_ID=${BERTH_AGENT_ID:-$(hostname)}
BERTH_DOCKER_BIN=${BERTH_DOCKER_BIN:-$(command -v docker || echo /usr/bin/docker)}
EOF

  chmod 0600 "$ENV_FILE"
}

write_systemd_unit() {
  local repo_root="$1"
  local template="$repo_root/apps/berth-agent/berth-agent.service"

  if [[ -f "$template" ]]; then
    install -m 0644 "$template" "$UNIT_PATH"
    return 0
  fi

  cat >"$UNIT_PATH" <<'EOF'
[Unit]
Description=Berth agent
After=network-online.target docker.service
Wants=network-online.target
Requires=docker.service

[Service]
Type=simple
EnvironmentFile=/etc/berth/agent.env
ExecStart=/usr/local/bin/berth-agent run
Restart=always
RestartSec=5
User=root
Group=root

[Install]
WantedBy=multi-user.target
EOF
}

enable_service() {
  log "reloading systemd and starting ${SERVICE_NAME}"
  systemctl daemon-reload
  systemctl enable --now "$SERVICE_NAME"
}

show_summary() {
  log "installation complete"
  systemctl --no-pager --full status "$SERVICE_NAME" || true
  printf '\n'
  log "env file: ${ENV_FILE}"
  log "binary:   ${BIN_PATH}"
}

main() {
  require_root
  detect_pkg_manager
  install_base_packages
  install_docker_if_needed
  install_rust_if_needed

  local repo_root
  repo_root="$(resolve_source_dir)"

  build_agent "$repo_root"
  write_env_file
  write_systemd_unit "$repo_root"
  enable_service
  show_summary
}

main "$@"
