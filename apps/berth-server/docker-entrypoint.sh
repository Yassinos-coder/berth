#!/bin/sh
set -e

cd /repo/apps/berth-server

echo "[berth-server] applying database migrations"
pnpm exec prisma migrate deploy --schema prisma/schema.prisma

echo "[berth-server] starting"
exec node dist/main.js
