# ── Build stage ───────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src/ ./src/
RUN npx tsc

# ── Runtime stage ─────────────────────────────────────────────────────────────
FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production

COPY --from=build /app/dist         ./dist
COPY --from=build /app/node_modules ./node_modules

EXPOSE 4000
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=5 \
  CMD wget -qO- http://localhost:4000/health || exit 1

CMD ["node", "dist/index.js"]
