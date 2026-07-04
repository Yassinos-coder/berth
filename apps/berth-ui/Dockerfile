# Build context is the repo root (see docker-compose.prod.yml).
# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build
RUN corepack enable
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/berth-ui/package.json apps/berth-ui/
RUN pnpm install --frozen-lockfile
COPY packages/protocol packages/protocol
COPY apps/berth-ui apps/berth-ui
RUN pnpm --filter @berth/protocol build \
 && pnpm --filter @berth/ui build

FROM nginx:1.27-alpine AS runtime
COPY apps/berth-ui/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /repo/apps/berth-ui/dist /usr/share/nginx/html
EXPOSE 80
