FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/web/package.json ./apps/web/

RUN npm ci --workspace=packages/shared --workspace=apps/web --ignore-scripts

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/web/ ./apps/web/
COPY tsconfig.base.json ./

# Build
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/web

# Copy static assets into standalone output
RUN cp -r apps/web/public apps/web/.next/standalone/apps/web/public 2>/dev/null || true
RUN cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME="0.0.0.0"
ENV NODE_ENV=production

CMD ["node", "apps/web/.next/standalone/apps/web/server.js"]
