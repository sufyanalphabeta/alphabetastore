# ── Stage 1: Build ───────────────────────────────────────────────
FROM node:20-bookworm-slim AS builder

WORKDIR /app

# 🔥 Required for Prisma
RUN apt-get update -y && apt-get install -y openssl

# Install dependencies
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client + build app
RUN npm run prisma:generate && npm run build


# ── Stage 2: Production ──────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Required for Prisma query engine (must match builder's openssl version)
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

# Create the non-root runtime identity before copying application files so
# ownership is applied while layers are created instead of recursively later.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nestjs

# 🔥 IMPORTANT: do NOT run npm ci again
# copy node_modules from builder (includes Prisma client)
COPY --from=builder --chown=nestjs:nodejs /app/node_modules ./node_modules

# copy built app
COPY --from=builder --chown=nestjs:nodejs /app/dist ./dist

# copy prisma (for migrations if needed)
COPY --chown=nestjs:nodejs prisma ./prisma

# The runtime user only needs write access to uploads. Docker Compose mounts the
# development uploads directory at this same path.
RUN install -d -o nestjs -g nodejs /app/uploads

# entrypoint
COPY --chown=nestjs:nodejs --chmod=755 docker-entrypoint.sh /app/docker-entrypoint.sh

USER nestjs

EXPOSE 3001

# 🔥 Healthcheck without wget (Node-based)
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3001/health', res => process.exit(res.statusCode===200?0:1)).on('error', () => process.exit(1))"

CMD ["/app/docker-entrypoint.sh"]
