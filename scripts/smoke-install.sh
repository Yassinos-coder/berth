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
container_name() { docker ps --filter "label=berth.service_id=$SERVICE_ID" --format '{{.Names}}' | head -n1; }
memory_limit_applied() {
  [ "$(docker inspect --format '{{.HostConfig.Memory}}' "$(container_name)")" = "134217728" ]
}
wait_for "memory limit raised live on the running container" 40 memory_limit_applied
wait_for "service still running after resource change" 12 service_running

api DELETE "/services/$SERVICE_ID" >/dev/null

echo "--- storage limits through the whole stack"
api PATCH "/servers/$SERVER_ID/storage" -d '{"storageBudgetGb":20}' >/dev/null
VOLUME_SERVICE_ID="$(api POST /services -d "$(jq -n --arg server "$SERVER_ID" '{
  name: "smoke-volume", kind: "image", serverId: $server,
  source: { kind: "image", image: "alpine", tag: "3.20" },
  command: ["sleep", "infinity"],
  volumePath: "/data", diskGb: 1,
  resources: { cpuCores: 0.25, memoryMb: 64 }
}')" | jq -r '.id')"

volume_container() { docker ps --filter "label=berth.service_id=$VOLUME_SERVICE_ID" --format '{{.Names}}' | head -n1; }
volume_running() { [ -n "$(volume_container)" ]; }
wait_for "limited-volume service running" 60 volume_running

WRITE="$(docker exec "$(volume_container)" sh -c 'dd if=/dev/zero of=/data/big bs=1M count=1200 2>&1; true')"
echo "$WRITE" | grep -q "No space left on device" || { echo "a 1 GB volume accepted 1.2 GB of data:"; echo "$WRITE"; exit 1; }
echo "ok: writing past the 1 GB limit is refused"

docker exec "$(volume_container)" sh -c 'rm -f /data/big; echo precious > /data/keep.txt; sync'
api PATCH "/services/$VOLUME_SERVICE_ID" -d '{"diskGb":2}' >/dev/null
volume_resized() { [ "$(docker exec "$(volume_container)" sh -c "df -m /data | tail -1 | awk '{print \$2}'" 2>/dev/null)" -ge 1900 ] 2>/dev/null; }
wait_for "volume grown to 2 GB" 60 volume_resized
[ "$(docker exec "$(volume_container)" cat /data/keep.txt)" = "precious" ] || { echo "data lost while resizing"; exit 1; }
echo "ok: grew the volume, data kept"
api DELETE "/services/$VOLUME_SERVICE_ID" >/dev/null
echo "install smoke test passed"
