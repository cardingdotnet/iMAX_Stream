# EgMax radio server — Dockerfile
#
# Multi-stage build keeps the final image tiny: only production deps + JS
# source, ~80MB total. Uses Node 20 LTS (Alpine for small base).

FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
# package-lock.json may not exist on first run; npm install handles both cases.
RUN npm install --omit=dev --no-audit --no-fund

FROM node:20-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=8080

# Copy production deps and source
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

# Run as non-root for safety
RUN addgroup -S radio && adduser -S radio -G radio && chown -R radio:radio /app
USER radio

EXPOSE 8080
CMD ["node", "src/server.js"]

# Optional liveness check used by Fly.io
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8080/healthz || exit 1
