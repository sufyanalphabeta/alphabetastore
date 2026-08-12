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

# Keep the production dependency tree separate from build and test tooling.
# Prisma remains a runtime dependency because the entrypoint applies migrations.
FROM builder AS production-deps
RUN npm prune --omit=dev && npm cache clean --force


# ── Stage 2: Production ──────────────────────────────────────────
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production

# Required for Prisma query engine (must match builder's openssl version).
# Upgrade only base packages with published Bookworm security fixes; avoid a
# broad dist-upgrade so the runtime remains predictable and reproducible.
RUN apt-get update -y && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends openssl && \
    DEBIAN_FRONTEND=noninteractive apt-get install -y --only-upgrade libc6 libc-bin libgnutls30 dpkg && \
    rm -rf /var/lib/apt/lists/*

# Runtime invokes Node and Prisma directly; package-manager CLIs are unnecessary.
RUN rm -rf /usr/local/lib/node_modules/npm /opt/yarn-v1.22.22 && \
    rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/yarn /usr/local/bin/yarnpkg

# Create the non-root runtime identity before copying application files so
# ownership is applied while layers are created instead of recursively later.
RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 --ingroup nodejs nestjs

# 🔥 IMPORTANT: do NOT run npm ci again
# copy node_modules from builder (includes Prisma client)
COPY --from=production-deps --chown=nestjs:nodejs /app/node_modules ./node_modules

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
