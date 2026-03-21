FROM node:20-alpine AS builder
WORKDIR /app

# Install all workspace dependencies
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
COPY apps/web/package.json ./apps/web/

RUN npm ci --ignore-scripts

# Copy all source
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/
COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

# Build shared package first
RUN npm run build --workspace=packages/shared

# Build Next.js static export
RUN npm run build --workspace=apps/web

# Build server
RUN npm run build --workspace=apps/server

# ── Runtime image ─────────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy only production dependencies
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN npm ci --workspace=packages/shared --workspace=apps/server --omit=dev --ignore-scripts

# Copy built artifacts
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/out ./apps/web/out

EXPOSE 3001

ENV NODE_ENV=production

CMD ["node", "apps/server/dist/index.js"]
