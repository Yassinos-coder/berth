#!/usr/bin/env bash
# End-to-end check against a panel installed by install.sh: registers the
# admin, waits for the local agent, deploys an image service, redeploys it,
# and confirms the container is running under Berth's labels.
set -euo pipefail

BASE="${BERTH_SMOKE_URL:-http://127.0.0.1:3000/api}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT

api() {
  local method="$1" path="$2"; shift 2
  curl -fsS -X "$method" -b "$JAR" -c "$JAR" \
    -H 'Content-Type: application/json' -H 'X-Berth-Client: smoke' \
    "$BASE$path" "$@"
}

wait_for() {
  local description="$1" attempts="$2"; shift 2
  for _ in $(seq 1 "$attempts"); do
    if "$@" >/dev/null 2>&1; then echo "ok: $description"; return 0; fi
    sleep 5
  done
  echo "timed out waiting for: $description"; return 1
}

panel_up() { curl -fsS "$BASE/auth/setup-state" | jq -e '.needsSetup == true'; }
wait_for "panel answers" 60 panel_up

api POST /auth/register \
  -d '{"name":"Smoke Admin","email":"smoke@example.com","password":"smoke-test-password"}' >/dev/null

server_online() { api GET /servers | jq -e '.[0].status == "online"'; }
wait_for "local agent online" 60 server_online
SERVER_ID="$(api GET /servers | jq -r '.[0].id')"

SERVICE_ID="$(api POST /services -d "$(jq -n --arg server "$SERVER_ID" '{
  name: "smoke-whoami", kind: "image", serverId: $server,
  source: { kind: "image", image: "traefik/whoami", tag: "latest" },
  containerPort: 80,
  resources: { cpuCores: 0.25, memoryMb: 64 }
}')" | jq -r '.id')"

service_running() { api GET "/services/$SERVICE_ID" | jq -e '.state == "running"'; }
wait_for "image service running" 60 service_running

docker ps --filter "label=berth.service_id=$SERVICE_ID" --format '{{.Names}}' | grep -q . \
  || { echo "no container carries the berth.service_id label"; exit 1; }

api POST "/services/$SERVICE_ID/redeploy" >/dev/null
wait_for "service running after redeploy" 60 service_running

api PATCH "/services/$SERVICE_ID" -d '{"resources":{"cpuCores":0.5,"memoryMb":128}}' >/dev/null
wait_for "service running after resource change" 60 service_running

LIMIT="$(docker inspect --format '{{.HostConfig.Memory}}' "$(docker ps --filter "label=berth.service_id=$SERVICE_ID" --format '{{.Names}}' | head -n1)")"
[ "$LIMIT" = "134217728" ] || { echo "memory limit not applied live: $LIMIT"; exit 1; }

api DELETE "/services/$SERVICE_ID" >/dev/null
echo "install smoke test passed"
