FROM node:20-alpine AS base
WORKDIR /app

# Install dependencies at root (workspace)
COPY package.json package-lock.json ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/

RUN npm ci --workspace=packages/shared --workspace=apps/server --ignore-scripts

# Copy source
COPY packages/shared/ ./packages/shared/
COPY apps/server/ ./apps/server/
COPY tsconfig.base.json ./

# Build shared then server
RUN npm run build --workspace=packages/shared
RUN npm run build --workspace=apps/server

EXPOSE 3001

CMD ["node", "apps/server/dist/index.js"]
