# Build context is the repo root (see docker-compose.prod.yml).
# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
ENV PNPM_HOME=/pnpm
ENV PATH=/pnpm:$PATH
RUN corepack enable

FROM base AS build
WORKDIR /repo
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/protocol/package.json packages/protocol/
COPY apps/berth-server/package.json apps/berth-server/
RUN pnpm install --frozen-lockfile
COPY packages/protocol packages/protocol
COPY apps/berth-server apps/berth-server
RUN pnpm --filter @berth/protocol build \
 && pnpm --filter @berth/server prisma:generate \
 && pnpm --filter @berth/server build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo/apps/berth-server
COPY --from=build /repo /repo
COPY apps/berth-server/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 4000 4443
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
