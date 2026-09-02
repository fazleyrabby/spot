# ==============================================================================
# Multi-stage Production Dockerfile for SPOT Monorepo
# Builds: @spot/shared, @spot/world, apps/web, and apps/server
# ==============================================================================

FROM node:20-alpine AS builder

WORKDIR /app

# Enable pnpm
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Copy package manifests for layer caching
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/world/package.json ./packages/world/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

# Install full dependencies for building
RUN pnpm install --frozen-lockfile

# Copy full source tree
COPY . .

# Build all monorepo workspaces
RUN pnpm build

# ==============================================================================
# Production Stage
# ==============================================================================
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=4323
ENV WEB_DIST_PATH=/app/apps/web/dist

# Enable pnpm for production dependency resolution
RUN corepack enable && corepack prepare pnpm@10.12.1 --activate

# Copy monorepo manifests
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/shared/dist ./packages/shared/dist/
COPY packages/world/package.json ./packages/world/
COPY packages/world/dist ./packages/world/dist/
COPY apps/server/package.json ./apps/server/
COPY apps/server/dist ./apps/server/dist/
COPY apps/web/dist ./apps/web/dist/

# Install production dependencies only
RUN pnpm install --prod --frozen-lockfile

EXPOSE 4323

HEALTHCHECK --interval=15s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:4323/health || exit 1

CMD ["node", "apps/server/dist/index.js"]
