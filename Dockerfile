# ---------------------------------------------------------------
# SipVault web image (Next.js standalone + Prisma)
# Multi-stage: deps -> builder -> small runtime image (~200 MB)
# ---------------------------------------------------------------
FROM node:20-alpine AS base
RUN apk add --no-cache libc6-compat openssl
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# 1) Install dependencies (cached unless package*.json changes)
FROM base AS deps
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci; else npm install; fi

# 2) Build the app
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# ASSET_PREFIX is only needed when JS/CSS are served from a CDN (prod). Empty for beta.
ARG ASSET_PREFIX=""
ENV ASSET_PREFIX=$ASSET_PREFIX
RUN npm run build

# 3) Runtime image - only what is needed to run
FROM base AS runner
ENV NODE_ENV=production \
    PORT=3000 \
    HOSTNAME=0.0.0.0

# Prisma CLI is used at container start to apply database migrations.
RUN npm install -g prisma@6 && \
    addgroup -S app && adduser -S app -G app

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
# Make sure the Prisma engine + client and bcryptjs (used by the seed script) are present
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client
COPY --from=builder /app/node_modules/bcryptjs ./node_modules/bcryptjs
COPY deploy/docker-entrypoint.sh /docker-entrypoint.sh

RUN mkdir -p /data/uploads && \
    chown -R app:app /data /app && \
    chmod +x /docker-entrypoint.sh

USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
