# Build context is the repo root (see docker-compose.prod.yml).
# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS base
RUN apt-get update \
 && apt-get install -y --no-install-recommends openssl ca-certificates \
 && rm -rf /var/lib/apt/lists/*
COPY --from=oven/bun:1.4.3 /usr/local/bin/bun /usr/local/bin/bun
RUN ln -s /usr/local/bin/bun /usr/local/bin/bunx

FROM base AS build
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
COPY apps/berth-server apps/berth-server
RUN bun --filter @berth/protocol build \
 && bun --filter @berth/server prisma:generate \
 && bun --filter @berth/server build

FROM base AS runtime
ARG BERTH_COMMIT=""
ENV NODE_ENV=production
ENV BERTH_COMMIT=${BERTH_COMMIT}
WORKDIR /repo/apps/berth-server
COPY --from=build /repo /repo
COPY apps/berth-server/docker-entrypoint.sh /usr/local/bin/entrypoint.sh
RUN chmod +x /usr/local/bin/entrypoint.sh
EXPOSE 4000 4443
ENTRYPOINT ["/usr/local/bin/entrypoint.sh"]
