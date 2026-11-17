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

echo "panel smoke test passed"
