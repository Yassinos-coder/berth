#!/usr/bin/env bash
# Berth panel installer — turns a fresh Debian/Ubuntu or Amazon Linux/RHEL VPS
# into a running panel.
# Usage:  curl -fsSL https://berth.sh | sudo bash
# The only manual step afterwards: open the printed URL and create your admin.
set -euo pipefail

REPO_URL_DEFAULT="https://github.com/Yassinos-coder/berth.git"
INSTALL_ROOT="/opt/berth"
ENV_DIR="/etc/berth"
COMPOSE_FILE="docker-compose.prod.yml"
PKG=""

log() { printf '\033[36m[berth/install]\033[0m %s\n' "$*"; }
fail() { printf '\033[31m[berth/install] ERROR:\033[0m %s\n' "$*" >&2; exit 1; }

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "run this script as root or with sudo"
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then PKG="apt"
  elif command -v dnf >/dev/null 2>&1; then PKG="dnf"
  elif command -v yum >/dev/null 2>&1; then PKG="yum"
  else fail "no supported package manager found (need apt, dnf, or yum)"; fi
  log "package manager: ${PKG}"
}

install_base_packages() {
  case "$PKG" in
    apt) apt-get update -y && apt-get install -y ca-certificates curl git openssl ;;
    dnf | yum) "$PKG" install -y ca-certificates curl git openssl ;;
  esac
}

ensure_compose() {
  docker compose version >/dev/null 2>&1 && return 0
  log "installing the Docker Compose plugin"
  local dir="/usr/libexec/docker/cli-plugins"
  install -d "$dir"
  curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
    -o "$dir/docker-compose"
  chmod +x "$dir/docker-compose"
}

install_docker_if_needed() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "docker + compose already installed"
    return 0
  fi

  log "installing Docker Engine"
  . /etc/os-release
  case "$PKG" in
    apt)
      install -m 0755 -d /etc/apt/keyrings
      curl -fsSL "https://download.docker.com/linux/${ID}/gpg" -o /etc/apt/keyrings/docker.asc
      chmod a+r /etc/apt/keyrings/docker.asc
      echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" \
        >/etc/apt/sources.list.d/docker.list
      apt-get update -y
      apt-get install -y docker-ce docker-ce-cli containerd.io \
        docker-buildx-plugin docker-compose-plugin
      ;;
    dnf | yum)
      # Amazon Linux / RHEL family ship a working docker package.
      "$PKG" install -y docker
      ;;
  esac
  systemctl enable --now docker
  ensure_compose
}

resolve_repo() {
  if [[ -f "$COMPOSE_FILE" && -d apps/berth-server ]]; then
    pwd
    return 0
  fi
  if [[ -d "$INSTALL_ROOT/.git" ]]; then
    git -C "$INSTALL_ROOT" pull --ff-only || true
  else
    log "cloning ${BERTH_REPO_URL:-$REPO_URL_DEFAULT} into ${INSTALL_ROOT}"
    git clone --depth 1 "${BERTH_REPO_URL:-$REPO_URL_DEFAULT}" "$INSTALL_ROOT"
  fi
  printf '%s\n' "$INSTALL_ROOT"
}

public_ip() {
  curl -fsSL https://api.ipify.org 2>/dev/null \
    || hostname -I 2>/dev/null | awk '{print $1}' \
    || echo "127.0.0.1"
}

generate_env() {
  local repo_root="$1" ip="$2"
  local env_file="$repo_root/.env"
  if [[ -f "$env_file" ]]; then
    log ".env already exists — keeping it"
    return 0
  fi

  log "generating .env with fresh secrets"
  local pg_pw jwt master boot
  pg_pw="$(openssl rand -hex 24)"
  jwt="$(openssl rand -hex 32)"
  master="$(openssl rand -base64 32)"
  boot="$(openssl rand -hex 24)"

  cat >"$env_file" <<EOF
NODE_ENV=production

# berth-ui
VITE_API_BASE=/api
BERTH_UI_PORT=3000

# database
POSTGRES_USER=berth
POSTGRES_PASSWORD=${pg_pw}
POSTGRES_DB=berth
DATABASE_URL=postgresql://berth:${pg_pw}@postgres:5432/berth
REDIS_URL=redis://redis:6379

# secrets
JWT_SECRET=${jwt}
BERTH_MASTER_KEY=${master}
BERTH_LOCAL_BOOTSTRAP=${boot}
BERTH_LOCAL_HOSTNAME=$(hostname)

# panel surface
BERTH_CORS_ORIGIN=http://${ip}:3000
BERTH_PUBLIC_PANEL_URL=wss://${ip}:4443
BERTH_COOKIE_SECURE=false
BERTH_CERT_DIR=./panel-certs
AGENT_WS_PORT=4443
EOF
  chmod 0600 "$env_file"
}

start_panel() {
  local repo_root="$1"
  log "building and starting the panel (this takes a few minutes on first run)"
  docker compose -f "$repo_root/$COMPOSE_FILE" --project-directory "$repo_root" up -d --build
}

wait_for_ca() {
  local repo_root="$1" ca="$1/panel-certs/ca.pem"
  log "waiting for the panel to generate its CA"
  for _ in $(seq 1 60); do
    [[ -f "$ca" ]] && { printf '%s\n' "$ca"; return 0; }
    sleep 2
  done
  fail "panel CA was not generated in time — check 'docker compose logs server'"
}

install_local_agent() {
  local repo_root="$1" ca_src="$2" boot="$3"
  install -d "$ENV_DIR"
  install -m 0644 "$ca_src" "$ENV_DIR/ca.crt"

  log "installing the native local agent"
  BERTH_PANEL_URL="wss://localhost:4443" \
  BERTH_BOOTSTRAP="$boot" \
  BERTH_AGENT_SOURCE_DIR="$repo_root" \
    bash "$repo_root/apps/berth-agent/install.sh"
}

main() {
  require_root
  detect_pkg_manager
  install_base_packages
  install_docker_if_needed

  local repo_root ip ca boot
  repo_root="$(resolve_repo)"
  cd "$repo_root"
  ip="$(public_ip)"

  generate_env "$repo_root" "$ip"
  start_panel "$repo_root"
  ca="$(wait_for_ca "$repo_root")"

  boot="$(grep '^BERTH_LOCAL_BOOTSTRAP=' "$repo_root/.env" | cut -d= -f2-)"
  install_local_agent "$repo_root" "$ca" "$boot"

  printf '\n\033[32m'
  log "Berth is up."
  log "Open  http://${ip}:3000  and create your admin account."
  log "The local server will come online automatically once you do."
  printf '\033[0m\n'
}

main "$@"
