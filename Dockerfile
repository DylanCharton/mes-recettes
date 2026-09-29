# syntax=docker/dockerfile:1
# ============================================================================
#  Mes recettes — image de production (API + front dans un seul processus)
#  docker build -t mes-recettes .
#  docker run -p 3000:3000 -v mes-recettes-data:/data --env-file .env mes-recettes
# ============================================================================

# Debian slim (glibc) : binaires précompilés de better-sqlite3, pas de compilation.
FROM node:22-slim AS build
WORKDIR /app
RUN corepack enable

# Dépendances d'abord : couche mise en cache tant que le lockfile ne change pas.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm --filter @mes-recettes/web build \
 && pnpm --filter @mes-recettes/api build \
 # Seule dépendance d'exécution hors bundle : better-sqlite3 (sans dépendance, binaires inclus).
 && mkdir -p /runtime/node_modules \
 && cp -rL node_modules/.pnpm/better-sqlite3@*/node_modules/better-sqlite3 /runtime/node_modules/

# ----------------------------------------------------------------------------
FROM node:22-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DATA_DIR=/data \
    TZ=Europe/Paris
WORKDIR /app

COPY --from=build /app/apps/api/dist apps/api/dist
COPY --from=build /app/apps/api/drizzle apps/api/drizzle
COPY --from=build /runtime/node_modules apps/api/node_modules
COPY --from=build /app/apps/web/dist apps/web/dist

RUN mkdir -p /data && chown node:node /data
USER node
VOLUME /data
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "--enable-source-maps", "apps/api/dist/server.js"]
