# Build context is the repo root (see docker-compose.prod.yml).
# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun
WORKDIR /repo
COPY package.json bun.lock ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/berth-server/package.json apps/berth-server/
COPY apps/berth-ui/package.json apps/berth-ui/
COPY apps/berth-landing-page/package.json apps/berth-landing-page/
COPY apps/berth-docs/package.json apps/berth-docs/
COPY packages/cli/package.json packages/cli/
RUN bun install --frozen-lockfile
COPY packages/protocol packages/protocol
COPY apps/berth-ui apps/berth-ui
RUN bun --filter @berth/protocol build \
 && bun --filter @berth/ui build

FROM nginx:1.27-alpine AS runtime
COPY apps/berth-ui/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /repo/apps/berth-ui/dist /usr/share/nginx/html
EXPOSE 80
