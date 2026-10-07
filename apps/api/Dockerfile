# syntax=docker/dockerfile:1.7
# Build from the repository root:  docker build -f apps/api/Dockerfile .

ARG NODE_VERSION=24-alpine

# ---- deps: install workspace deps with a warm cache ---------------------------
FROM node:${NODE_VERSION} AS deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --ignore-scripts -w @pokerplan/shared -w @pokerplan/api --include-workspace-root \
 && npm rebuild prisma @prisma/engines

# ---- build: compile shared + api, generate the Prisma client ------------------
FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
RUN npm run build -w @pokerplan/shared \
 && npm run prisma:generate -w @pokerplan/api \
 && npm run build -w @pokerplan/api

# ---- prod-deps: runtime dependencies only ------------------------------------
FROM node:${NODE_VERSION} AS prod-deps
WORKDIR /app
RUN apk add --no-cache openssl
COPY package.json package-lock.json ./
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
RUN --mount=type=cache,target=/root/.npm \
    npm ci --omit=dev --ignore-scripts -w @pokerplan/shared -w @pokerplan/api \
 && npm rebuild prisma @prisma/engines \
 && mkdir -p apps/api/node_modules

# ---- runtime ------------------------------------------------------------------
FROM node:${NODE_VERSION} AS runtime
RUN apk add --no-cache openssl tini
ENV NODE_ENV=production \
    PORT=4100
WORKDIR /app
COPY --from=prod-deps --chown=node:node /app/node_modules ./node_modules
COPY --from=prod-deps --chown=node:node /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build --chown=node:node /app/packages/shared/package.json ./packages/shared/
COPY --from=build --chown=node:node /app/packages/shared/dist ./packages/shared/dist
COPY --from=build --chown=node:node /app/apps/api/package.json /app/apps/api/prisma.config.ts ./apps/api/
COPY --from=build --chown=node:node /app/apps/api/prisma ./apps/api/prisma
COPY --from=build --chown=node:node /app/apps/api/dist ./apps/api/dist
USER node
WORKDIR /app/apps/api
EXPOSE 4100
HEALTHCHECK --interval=15s --timeout=5s --start-period=20s --retries=5 \
  CMD wget -qO- "http://127.0.0.1:${PORT}/health" >/dev/null || exit 1
ENTRYPOINT ["/sbin/tini", "--"]
# Apply pending migrations, then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
