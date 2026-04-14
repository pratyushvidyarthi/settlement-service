# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

# Copy workspace manifests first so npm ci is cached independently of source.
COPY package*.json ./
COPY mock-gateway/package*.json ./mock-gateway/
RUN npm ci

COPY tsconfig.json drizzle.config.ts ./
COPY src/ ./src/
RUN npx tsc

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist         ./dist
COPY --from=build /app/node_modules ./node_modules

# Migrations are SQL files that server.ts applies at startup via migrate().
COPY --from=build /app/src/db/migrations ./src/db/migrations

EXPOSE 3000
HEALTHCHECK --interval=10s --timeout=3s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

CMD ["node", "dist/server.js"]
