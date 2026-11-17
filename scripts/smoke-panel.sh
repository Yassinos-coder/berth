#!/usr/bin/env bash
set -euo pipefail

PORT="${BERTH_HTTP_PORT:-4000}"
BASE="http://127.0.0.1:${PORT}/api"
LOG="$(mktemp)"

cd "$(dirname "$0")/../apps/berth-server"

node dist/main.js >"$LOG" 2>&1 &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true; rm -f "$LOG"' EXIT

for _ in $(seq 1 40); do
  if curl -fsS "$BASE/auth/setup-state" >/dev/null 2>&1; then break; fi
  if ! kill -0 "$SERVER_PID" 2>/dev/null; then
    echo "panel exited during startup"; cat "$LOG"; exit 1
  fi
  sleep 1
done

HEADERS="$(curl -fsS -D - -o /dev/null -H 'x-request-id: smoke-test-0001' "$BASE/auth/setup-state")"
echo "$HEADERS" | grep -qi '^x-request-id: smoke-test-0001' || { echo "request id not echoed"; exit 1; }

BODY="$(curl -fsS "$BASE/auth/setup-state")"
echo "$BODY" | grep -q 'needsSetup\|setup' || { echo "unexpected setup-state: $BODY"; exit 1; }

STATUS="$(curl -s -o /dev/null -w '%{http_code}' "$BASE/services")"
[ "$STATUS" = "401" ] || { echo "unauthenticated /services returned $STATUS, expected 401"; exit 1; }

json() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const v=JSON.parse(d);const r=eval("v"+process.argv[1]);console.log(r===undefined?"":r)})' "$1"; }
JAR="$(mktemp)"
trap 'kill "$SERVER_PID" 2>/dev/null || true; rm -f "$LOG" "$JAR"' EXIT
call() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' -H 'X-Berth-Client: smoke' -X "$method" "$BASE$path" -d "$body"
  else
    curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" -H 'X-Berth-Client: smoke' -X "$method" "$BASE$path"
  fi
}
expect() { [ "$1" = "$2" ] || { echo "FAIL $3: expected $2, got $1"; cat "$LOG" | tail -20; exit 1; }; }

curl -fsS -c "$JAR" -H 'Content-Type: application/json' -H 'X-Berth-Client: smoke'   -d '{"name":"Smoke Admin","email":"smoke@example.com","password":"smoke-test-password"}' "$BASE/auth/register" >/dev/null
SERVER_ID="$(curl -fsS -b "$JAR" -H 'X-Berth-Client: smoke' -H 'Content-Type: application/json' -X POST "$BASE/servers/enroll" -d '{"name":"smoke"}' >/dev/null; curl -fsS -b "$JAR" "$BASE/servers" | json '[0].id')"

SERVICE_BODY="{\"name\":\"smoke-app\",\"kind\":\"image\",\"serverId\":\"$SERVER_ID\",\"source\":{\"kind\":\"image\",\"image\":\"traefik/whoami\",\"tag\":\"latest\"},\"containerPort\":80,\"resources\":{\"cpuCores\":0.25,\"memoryMb\":64}}"
CREATE_BODY="$(curl -s -w '
%{http_code}' -b "$JAR" -H 'Content-Type: application/json' -H 'X-Berth-Client: smoke' -X POST "$BASE/services" -d "$SERVICE_BODY")"
expect "$(echo "$CREATE_BODY" | tail -n1)" 201 "create service (capacity lock)"
SERVICE_ID="$(echo "$CREATE_BODY" | head -n1 | json '.id')"

expect "$(call PATCH "/services/$SERVICE_ID" '{"resources":{"cpuCores":0.5,"memoryMb":128}}')" 200 "raise limits"
expect "$(call PATCH "/services/$SERVICE_ID" '{"resources":{"cpuCores":0.5,"memoryMb":65536}}')" 400 "reject limits beyond the server"
expect "$(call POST "/services/$SERVICE_ID/scale" '{"replicas":2}')" 201 "scale replicas"
expect "$(call DELETE "/services/$SERVICE_ID")" 204 "delete service"

echo "panel smoke test passed"
