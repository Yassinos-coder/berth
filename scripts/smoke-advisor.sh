#!/usr/bin/env bash
set -euo pipefail

PORT="${BERTH_HTTP_PORT:-4000}"
STUB_PORT="${BERTH_STUB_PORT:-4999}"
BASE="http://127.0.0.1:${PORT}/api"
LOG="$(mktemp)"
CAPTURE="$(mktemp)"
JAR="$(mktemp)"
SECRET_VALUE="hunter2-do-not-leak"
API_KEY="sk-stub-advisor-key-123456"

cd "$(dirname "$0")/../apps/berth-server"

node dist/main.js >"$LOG" 2>&1 &
SERVER_PID=$!
STUB_PID=""
cleanup() {
  kill "$SERVER_PID" 2>/dev/null || true
  [ -n "$STUB_PID" ] && kill "$STUB_PID" 2>/dev/null || true
  rm -f "$LOG" "$CAPTURE" "$JAR"
}
trap cleanup EXIT

json() { node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const v=JSON.parse(d);const r=eval("v"+process.argv[1]);console.log(r===undefined?"":typeof r==="object"?JSON.stringify(r):r)})' "$1"; }
fail() { echo "FAIL $1"; tail -20 "$LOG"; [ -s "$CAPTURE" ] && node -e 'const c=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const p=JSON.parse(c.body).messages[1].content;const i=p.indexOf("smoke-app");console.log("PROMPT NEAR SERVICE:",p.slice(Math.max(0,i-200),i+200))' "$CAPTURE"; exit 1; }
expect() { [ "$1" = "$2" ] || fail "$3: expected $2, got $1"; }
call() {
  local method="$1" path="$2" body="${3:-}"
  if [ -n "$body" ]; then
    curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' -H 'X-Berth-Client: smoke' -X "$method" "$BASE$path" -d "$body"
  else
    curl -s -o /dev/null -w '%{http_code}' -b "$JAR" -c "$JAR" -H 'X-Berth-Client: smoke' -X "$method" "$BASE$path"
  fi
}
get() { curl -fsS -b "$JAR" -H 'X-Berth-Client: smoke' "$BASE$1"; }
send() { curl -fsS -b "$JAR" -c "$JAR" -H 'Content-Type: application/json' -H 'X-Berth-Client: smoke' -X "$1" "$BASE$2" ${3:+-d "$3"}; }

for _ in $(seq 1 40); do
  curl -fsS "$BASE/auth/setup-state" >/dev/null 2>&1 && break
  kill -0 "$SERVER_PID" 2>/dev/null || { echo "panel exited during startup"; cat "$LOG"; exit 1; }
  sleep 1
done

STUB_SCRIPT='
const http = require("http");
const fs = require("fs");
http.createServer((req, res) => {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    fs.writeFileSync(process.argv[1], JSON.stringify({ url: req.url, auth: req.headers.authorization || "", body }));
    const prompt = JSON.parse(body).messages.map((m) => m.content).join("\n");
    const serviceId = (/"id":"([^"]+)","name":"smoke-app"/.exec(prompt) || [])[1] || "missing";
    const findings = [
      { fingerprint: "ai:smoke-memory:" + serviceId, kind: "resources", severity: "warning", title: "Give smoke-app more memory", detail: "It peaked high.", serviceId, action: { type: "set-resources", serviceId, memoryMb: 1024 } },
      { fingerprint: "ai:smoke-bad", kind: "config", severity: "critical", title: "Delete everything", detail: "<b>do it</b> https://evil.example", serviceId, action: { type: "delete-service", serviceId } },
    ];
    res.setHeader("content-type", "application/json");
    res.end(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ findings }) } }], usage: { prompt_tokens: 1000, completion_tokens: 200 } }));
  });
}).listen(Number(process.argv[2]), "127.0.0.1");
'
node -e "$STUB_SCRIPT" "$CAPTURE" "$STUB_PORT" &
STUB_PID=$!
sleep 1

curl -fsS -c "$JAR" -H 'Content-Type: application/json' -H 'X-Berth-Client: smoke' \
  -d '{"name":"Smoke Admin","email":"advisor@example.com","password":"smoke-test-password"}' "$BASE/auth/register" >/dev/null
send POST /servers/enroll '{"name":"smoke"}' >/dev/null
SERVER_ID="$(get /servers | json '[0].id')"

SERVICE_BODY="{\"name\":\"smoke-app\",\"kind\":\"image\",\"serverId\":\"$SERVER_ID\",\"source\":{\"kind\":\"image\",\"image\":\"traefik/whoami\",\"tag\":\"latest\"},\"containerPort\":80,\"resources\":{\"cpuCores\":0.25,\"memoryMb\":256},\"env\":[{\"key\":\"SECRET_TOKEN\",\"value\":\"$SECRET_VALUE\",\"isSecret\":true}]}"
SERVICE_ID="$(send POST /services "$SERVICE_BODY" | json '.id')"

expect "$(call PUT /advisor/settings '{"enabled":true,"provider":"custom","baseUrl":"https://api.example.com/v1","model":"stub","apiKey":"short"}')" 400 "a malformed key is refused"
expect "$(call PUT /advisor/settings "{\"enabled\":true,\"provider\":\"custom\",\"baseUrl\":\"http://169.254.169.254/v1\",\"model\":\"stub\",\"apiKey\":\"$API_KEY\"}")" 400 "the cloud metadata address is refused"
expect "$(call PUT /advisor/settings "{\"enabled\":true,\"provider\":\"custom\",\"baseUrl\":\"http://example.com/v1\",\"model\":\"stub\",\"apiKey\":\"$API_KEY\"}")" 400 "plain http to a public host is refused"
expect "$(call PUT /advisor/settings '{"enabled":true,"provider":"custom","baseUrl":"http://127.0.0.1:'"$STUB_PORT"'/v1","model":"stub"}')" 400 "enabling without a key is refused"

SETTINGS="$(send PUT /advisor/settings "{\"enabled\":true,\"provider\":\"custom\",\"baseUrl\":\"http://127.0.0.1:$STUB_PORT/v1\",\"model\":\"stub\",\"apiKey\":\"$API_KEY\",\"monthlyCapUsd\":5}")"
expect "$(echo "$SETTINGS" | json '.hasKey')" true "key saved"
echo "$SETTINGS" | grep -q "$API_KEY" && fail "the API key was returned by the settings endpoint"
get /advisor/settings | grep -q "$API_KEY" && fail "the API key was returned by GET settings"

RUN="$(send POST /advisor/run)"
expect "$(echo "$RUN" | json '.usedAi')" true "the AI provider was used"

expect "$(grep -c "$SECRET_VALUE" "$CAPTURE" || true)" 0 "environment values never reach the provider"
grep -q "Bearer $API_KEY" "$CAPTURE" || fail "the provider did not receive the key"

FINDINGS="$(get '/advisor/findings?view=open')"
echo "$FINDINGS" | grep -q "Give smoke-app more memory" || fail "the AI suggestion is missing: $FINDINGS"
BAD_ACTION="$(echo "$FINDINGS" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const f=JSON.parse(d).find(x=>x.title==="Delete everything");console.log(f?(f.action?"kept":"dropped"):"absent")})')"
[ "$BAD_ACTION" != "kept" ] || fail "an unknown action was accepted"
echo "$FINDINGS" | grep -q "evil.example" && fail "a link survived sanitising"
FINDING_ID="$(echo "$FINDINGS" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const f=JSON.parse(d).find(x=>x.title==="Give smoke-app more memory");console.log(f?f.id:"")})')"
[ -n "$FINDING_ID" ] || fail "could not find the finding id"

SUMMARY="$(get /advisor/summary)"
[ "$(echo "$SUMMARY" | json '.openCount')" -ge 1 ] || fail "the header count is empty: $SUMMARY"
expect "$(call POST /advisor/run)" 400 "a second run inside the cooldown is refused"

APPLY_BODY="$(curl -s -b "$JAR" -H "X-Berth-Client: smoke" -X POST "$BASE/advisor/findings/$FINDING_ID/apply")"; echo "apply response: $APPLY_BODY"
expect "$(echo "$APPLY_BODY" | json ".status")" applied "apply"
expect "$(get "/services/$SERVICE_ID" | json '.resources.memoryMb')" 1024 "the memory change was applied"
expect "$(call POST "/advisor/findings/$FINDING_ID/apply")" 400 "applying twice is refused"
expect "$(call POST "/advisor/findings/$FINDING_ID/undo")" 200 "undo"
expect "$(get "/services/$SERVICE_ID" | json '.resources.memoryMb')" 256 "the memory change was reverted"

expect "$(call DELETE "/services/$SERVICE_ID")" 204 "delete service"
echo "advisor smoke test passed"
