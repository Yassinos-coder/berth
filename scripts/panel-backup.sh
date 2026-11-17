#!/usr/bin/env bash
# Berth panel backup and restore.
#   berth-backup                 write a backup now (the nightly timer runs this)
#   berth-backup list            show the backups on this server
#   berth-backup install-timer   set up the nightly backup (done by the installer)
#   berth-backup restore FILE    restore the database from a backup
#   berth-backup restore FILE --with-config   also restore .env and the CA certificates
# A backup holds the panel database, .env (which contains BERTH_MASTER_KEY) and the
# CA certificates. Keep copies off this server: the key and the data are both here.
set -euo pipefail

ROOT="${BERTH_REPO_DIR:-/opt/berth}"
DEST="${BERTH_BACKUP_DIR:-/var/backups/berth}"
KEEP="${BERTH_BACKUP_KEEP:-14}"
PG_CONTAINER="${BERTH_PG_CONTAINER:-berth-postgres}"
SERVER_CONTAINER="${BERTH_SERVER_CONTAINER:-berth-server}"

log() { printf '[berth/backup] %s\n' "$*"; }
die() { printf '[berth/backup] %s\n' "$*" >&2; exit 1; }

env_value() {
  local key="$1" fallback="$2" value
  value="$(grep -E "^${key}=" "$ROOT/.env" 2>/dev/null | tail -n1 | cut -d= -f2- || true)"
  printf '%s' "${value:-$fallback}"
}

backup() {
  [[ -d "$ROOT" ]] || die "no Berth install found at $ROOT"
  docker inspect "$PG_CONTAINER" >/dev/null 2>&1 || die "the database container $PG_CONTAINER is not running"

  local user db stamp work out
  user="$(env_value POSTGRES_USER berth)"
  db="$(env_value POSTGRES_DB berth)"
  stamp="$(date +%Y%m%d-%H%M%S)"
  umask 077
  mkdir -p "$DEST"
  work="$(mktemp -d "$DEST/.work.XXXXXX")"
  trap "rm -rf '$work'" EXIT

  docker exec "$PG_CONTAINER" pg_dump -U "$user" -d "$db" --format=custom --no-owner >"$work/db.dump"
  [[ -s "$work/db.dump" ]] || die "the database dump is empty"
  docker exec -i "$PG_CONTAINER" pg_restore --list <"$work/db.dump" >/dev/null \
    || die "the database dump could not be read back"

  [[ -f "$ROOT/.env" ]] && cp "$ROOT/.env" "$work/env"
  [[ -d "$ROOT/panel-certs" ]] && cp -a "$ROOT/panel-certs" "$work/panel-certs"

  out="$DEST/berth-$stamp.tar.gz"
  tar -czf "$out.partial" -C "$work" .
  mv "$out.partial" "$out"
  chmod 0600 "$out"
  log "wrote $out ($(du -h "$out" | cut -f1))"

  prune
}

prune() {
  local old
  old="$(ls -1t "$DEST"/berth-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) || true)"
  [[ -z "$old" ]] && return 0
  printf '%s\n' "$old" | xargs rm -f
  log "removed backups older than the newest $KEEP"
}

list() {
  ls -1t "$DEST"/berth-*.tar.gz 2>/dev/null || log "no backups yet in $DEST"
}

restore() {
  local file="${1:-}" with_config="${2:-}" user db work
  [[ -n "$file" && -f "$file" ]] || die "usage: berth-backup restore FILE [--with-config]"
  tar -tzf "$file" ./db.dump >/dev/null 2>&1 || die "$file is not a Berth backup"

  user="$(env_value POSTGRES_USER berth)"
  db="$(env_value POSTGRES_DB berth)"
  work="$(mktemp -d)"
  trap "rm -rf '$work'" EXIT
  tar -xzf "$file" -C "$work"

  log "stopping the panel (deployed services keep running)"
  docker stop "$SERVER_CONTAINER" >/dev/null 2>&1 || true

  if [[ "$with_config" == "--with-config" ]]; then
    [[ -f "$work/env" ]] && install -m 0600 "$work/env" "$ROOT/.env"
    if [[ -d "$work/panel-certs" ]]; then
      mkdir -p "$ROOT/panel-certs"
      cp -a "$work/panel-certs/." "$ROOT/panel-certs/"
    fi
    log "restored .env and certificates"
    user="$(env_value POSTGRES_USER berth)"
    db="$(env_value POSTGRES_DB berth)"
  fi

  log "restoring the database"
  docker exec -i "$PG_CONTAINER" pg_restore -U "$user" -d "$db" --clean --if-exists --no-owner <"$work/db.dump"

  log "starting the panel"
  docker start "$SERVER_CONTAINER" >/dev/null
  log "done"
}

install_timer() {
  [[ "$(id -u)" -eq 0 ]] || die "run this as root"
  cat >/usr/local/bin/berth-backup <<WRAPPER
#!/usr/bin/env bash
exec env BERTH_REPO_DIR="${ROOT}" BERTH_BACKUP_DIR="${DEST}" bash "${ROOT}/scripts/panel-backup.sh" "\$@"
WRAPPER
  chmod 0755 /usr/local/bin/berth-backup

  command -v systemctl >/dev/null 2>&1 || { log "systemd not found, skipping the nightly timer. Run 'sudo berth-backup' from cron instead."; return 0; }

  cat >/etc/systemd/system/berth-backup.service <<UNIT
[Unit]
Description=Berth panel backup
After=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/berth-backup backup
Nice=10
UNIT
  cat >/etc/systemd/system/berth-backup.timer <<UNIT
[Unit]
Description=Nightly Berth panel backup

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=15m
Persistent=true

[Install]
WantedBy=timers.target
UNIT
  systemctl daemon-reload
  systemctl enable --now berth-backup.timer >/dev/null
  log "nightly backups on, kept in $DEST (newest $KEEP). Run 'sudo berth-backup' any time."
}

case "${1:-backup}" in
  install-timer) install_timer ;;
  backup) backup ;;
  list) list ;;
  restore) shift; restore "$@" ;;
  *) die "unknown command: $1 (use backup, list, restore or install-timer)" ;;
esac
