#!/usr/bin/env bash
# Berth panel installer — turns a fresh Debian/Ubuntu or Amazon Linux/RHEL VPS
# into a running panel. Safe to re-run.
# Usage:  curl -fsSL https://berth.sh | sudo bash
# The only manual step afterwards: open the printed URL and create your admin.
set -uo pipefail

REPO_URL_DEFAULT="https://github.com/Yassinos-coder/berth.git"
INSTALL_ROOT="/opt/berth"
ENV_DIR="/etc/berth"
COMPOSE_FILE="docker-compose.prod.yml"
LOG="/var/log/berth-install.log"
PKG=""
REPO_ROOT=""
PUBLIC_IP=""
CA_PATH=""
REUSE_ENV=1

C_RESET=$'\033[0m'; C_DIM=$'\033[2m'; C_CYAN=$'\033[36m'
C_GREEN=$'\033[32m'; C_RED=$'\033[31m'; C_YELLOW=$'\033[33m'; C_BOLD=$'\033[1m'

log() { printf '%s\n' "$*"; }
fail() { printf '\n%s✗ %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; exit 1; }

require_root() {
  [[ "${EUID}" -eq 0 ]] || fail "run as root:  curl -fsSL … | sudo bash"
}

# Run a phase quietly: show a spinner-ish line, log details, then ✓ or ✗.
step() {
  local msg="$1"; shift
  printf '  %s…%s %s' "$C_CYAN" "$C_RESET" "$msg"
  if "$@" >>"$LOG" 2>&1; then
    printf '\r  %s✓%s %s\033[K\n' "$C_GREEN" "$C_RESET" "$msg"
  else
    local code=$?
    printf '\r  %s✗%s %s\033[K\n\n' "$C_RED" "$C_RESET" "$msg"
    printf '%sInstall failed at this step. Recent log (%s):%s\n' "$C_RED" "$LOG" "$C_RESET" >&2
    tail -n 25 "$LOG" >&2
    exit "$code"
  fi
}

# Ask a yes/no on the real terminal (works even under `curl | bash`). Default yes.
confirm() {
  local q="$1" ans=""
  [[ -e /dev/tty ]] || return 0
  printf '  %s?%s %s [Y/n] ' "$C_YELLOW" "$C_RESET" "$q" >/dev/tty
  read -r ans </dev/tty || return 0
  case "$ans" in [nN]*) return 1 ;; *) return 0 ;; esac
}

detect_pkg_manager() {
  if command -v apt-get >/dev/null 2>&1; then PKG="apt"
  elif command -v dnf >/dev/null 2>&1; then PKG="dnf"
  elif command -v yum >/dev/null 2>&1; then PKG="yum"
  else fail "no supported package manager (need apt, dnf, or yum)"; fi
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
  local dir="/usr/libexec/docker/cli-plugins"
  install -d "$dir"
  curl -fsSL "https://github.com/docker/compose/releases/latest/download/docker-compose-linux-$(uname -m)" \
    -o "$dir/docker-compose"
  chmod +x "$dir/docker-compose"
}

install_docker_if_needed() {
  if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
    log "docker + compose already present"
    return 0
  fi
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
      "$PKG" install -y docker
      ;;
  esac
  systemctl enable --now docker
  ensure_compose
  command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1
}

fetch_repo() {
  if [[ -f "$COMPOSE_FILE" && -d apps/berth-server ]]; then
    REPO_ROOT="$(pwd)"
    return 0
  fi
  if [[ -d "$INSTALL_ROOT/.git" ]]; then
    git -C "$INSTALL_ROOT" fetch --depth 1 origin production
    git -C "$INSTALL_ROOT" checkout -B production origin/production
    git -C "$INSTALL_ROOT" reset --hard origin/production
  else
    git clone --depth 1 --branch production \
      "${BERTH_REPO_URL:-$REPO_URL_DEFAULT}" "$INSTALL_ROOT"
  fi
  REPO_ROOT="$INSTALL_ROOT"
  chmod +x "$REPO_ROOT/scripts/self-update.sh" 2>/dev/null || true
  [[ -f "$REPO_ROOT/$COMPOSE_FILE" ]]
}

detect_ip() {
  PUBLIC_IP="$(curl -fsSL --max-time 8 https://api.ipify.org 2>/dev/null || true)"
  [[ -n "$PUBLIC_IP" ]] || PUBLIC_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
  [[ -n "$PUBLIC_IP" ]] || PUBLIC_IP="127.0.0.1"
}

generate_env() {
  local env_file="$REPO_ROOT/.env"
  if [[ -f "$env_file" && "${REUSE_ENV}" -eq 1 ]]; then
    log "reusing existing .env"
    return 0
  fi

  local pg_pw jwt master boot
  pg_pw="$(openssl rand -hex 24)"
  jwt="$(openssl rand -hex 32)"
  master="$(openssl rand -base64 32)"
  boot="$(openssl rand -hex 24)"

  cat >"$env_file" <<EOF
NODE_ENV=production

# berth-ui
VITE_API_BASE=/api

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
BERTH_CORS_ORIGIN=http://${PUBLIC_IP}:3000
BERTH_PUBLIC_PANEL_URL=wss://${PUBLIC_IP}:4443
BERTH_COOKIE_SECURE=false
BERTH_CERT_DIR=./panel-certs
AGENT_WS_PORT=4443
EOF
  chmod 0600 "$env_file"
}

start_panel() {
  local commit
  commit="$(git -C "$REPO_ROOT" rev-parse --short HEAD 2>/dev/null || echo unknown)"
  BERTH_COMMIT="$commit" \
    docker compose -f "$REPO_ROOT/$COMPOSE_FILE" --project-directory "$REPO_ROOT" up -d --build
}

install_update_helpers() {
  cat >/usr/local/bin/berth-update <<EOF
#!/usr/bin/env bash
exec env BERTH_REPO_DIR="${INSTALL_ROOT}" bash "${INSTALL_ROOT}/scripts/self-update.sh"
EOF
  chmod 0755 /usr/local/bin/berth-update

  cat >/etc/update-motd.d/99-berth <<'EOF'
#!/usr/bin/env bash
repo=/opt/berth
[[ -d "$repo/.git" ]] || exit 0
git -C "$repo" fetch -q --depth 1 origin production 2>/dev/null || exit 0
local_sha="$(git -C "$repo" rev-parse HEAD 2>/dev/null)"
remote_sha="$(git -C "$repo" rev-parse origin/production 2>/dev/null)"
if [[ -n "$remote_sha" && "$local_sha" != "$remote_sha" ]]; then
  printf '\n\033[36m⬆ A Berth update is available.\033[0m Run: \033[1msudo berth-update\033[0m\n\n'
fi
EOF
  chmod 0755 /etc/update-motd.d/99-berth
}

wait_for_ca() {
  local ca="$REPO_ROOT/panel-certs/ca.pem" i
  for i in $(seq 1 90); do
    [[ -f "$ca" ]] && { CA_PATH="$ca"; return 0; }
    sleep 2
  done
  echo "panel CA not generated within 180s; recent server logs:"
  docker compose -f "$REPO_ROOT/$COMPOSE_FILE" --project-directory "$REPO_ROOT" logs --tail 40 server
  return 1
}

install_local_agent() {
  local boot
  install -d "$ENV_DIR"
  install -m 0644 "$CA_PATH" "$ENV_DIR/ca.crt"
  boot="$(grep '^BERTH_LOCAL_BOOTSTRAP=' "$REPO_ROOT/.env" | cut -d= -f2-)"
  BERTH_PANEL_URL="wss://localhost:4443" \
  BERTH_BOOTSTRAP="$boot" \
  BERTH_AGENT_SOURCE_DIR="$REPO_ROOT" \
  BERTH_REPO_DIR="$REPO_ROOT" \
    bash "$REPO_ROOT/apps/berth-agent/install.sh"
}

main() {
  require_root
  mkdir -p "$(dirname "$LOG")" 2>/dev/null || true
  : >"$LOG" 2>/dev/null || { LOG="/tmp/berth-install.log"; : >"$LOG"; }

  printf '\n %sInstalling Berth%s  %s(details logged to %s)%s\n\n' \
    "$C_BOLD" "$C_RESET" "$C_DIM" "$LOG" "$C_RESET"

  if [[ -f "$INSTALL_ROOT/.env" ]]; then
    confirm "Existing Berth config found — reuse it (keep your data & secrets)?" \
      && REUSE_ENV=1 || REUSE_ENV=0
  fi

  step "Detecting the operating system"                 detect_pkg_manager
  step "Installing base packages"                       install_base_packages
  step "Installing Docker"                              install_docker_if_needed
  step "Fetching Berth"                                 fetch_repo
  detect_ip
  step "Generating configuration"                       generate_env
  step "Building & starting the panel (a few minutes)"  start_panel
  step "Waiting for the panel to come online"           wait_for_ca
  step "Installing & enrolling the local agent"         install_local_agent
  step "Installing update helpers"                      install_update_helpers

  printf '\n %s%s✓ Berth is up!%s\n\n' "$C_BOLD" "$C_GREEN" "$C_RESET"
  printf '   Open  %shttp://%s:3000%s  and create your admin account.\n' \
    "$C_CYAN" "$PUBLIC_IP" "$C_RESET"
  printf '   The local server comes online automatically once you do.\n\n'
}

main "$@"
