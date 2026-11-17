#!/bin/sh
set -e

cd /repo/apps/berth-server

echo "[berth-server] applying database migrations"
bunx prisma db execute --file prisma/pad-migration-names.sql
bunx prisma migrate deploy

echo "[berth-server] starting"
exec node dist/main.js
