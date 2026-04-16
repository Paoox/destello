# ── Destello API — Dockerfile ────────────────────────────────
# Multi-stage: build liviano para la Toshiba

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache curl

# ── Instalar dependencias ──────────────────────────────────
FROM base AS deps
COPY package.json ./
RUN npm install --omit=dev --frozen-lockfile

# ── Imagen final ───────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY package.json ./

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=10s --start-period=15s \
  CMD curl -f http://localhost:3001/health || exit 1

CMD ["node", "src/index.js"]
